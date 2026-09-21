const express = require('express');
const router = express.Router();

const Medication = require('../models/Medication');
const Resident = require('../models/Resident');
const MedicationLog = require('../models/MedicationLog');
const ScanHistory = require('../models/ScanHistory');
const MedicationFlag = require('../models/MedicationFlag');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/auditLog');
const { isOnDuty } = require('../utils/shiftUtils');
const imageUpload = require('../middleware/imageUpload');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

function streamUploadFlagPhoto(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'kanang-alalay/medication-flags', public_id: publicId, overwrite: true, resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

const canSeeAllScans = (user) => ['admin', 'head_caregiver'].includes(user.role);

// Mirrors the assignment check used by GET /api/residents/assigned, so a
// caregiver only sees residents actually assigned to them when scanning.
const isAssignedToCaregiver = (resident, user) => {
  if (canSeeAllScans(user)) return true;
  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return (
    String(resident.primaryCaregiverId || '') === String(user._id) ||
    resident.primaryCaregiverName === userName ||
    resident.primaryCaregiver === userName ||
    resident.assignedNurse === userName ||
    resident.assignedCaregiver === userName ||
    String(resident.assignedStaff?.primaryCaregiverId || '') === String(user._id) ||
    resident.assignedStaff?.primaryCaregiverName === userName ||
    resident.assignedStaff?.primaryCaregiver === userName ||
    resident.assignedStaff?.assignedNurse === userName ||
    resident.assignedStaff?.assignedCaregiver === userName
  );
};

// POST /api/medication-scanner/lookup
router.post('/lookup', protect, async (req, res) => {
  try {
    const { barcode } = req.body;
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const cleanBarcode = String(barcode).replace(/[$\s-]/g, '');

    let medication = await Medication.findOne({
      $or: [
        { barcode: cleanBarcode },
        { barcode: barcode },
        { ndc: cleanBarcode },
        { ndc: barcode },
      ],
    });

    if (!medication) {
      medication = await Medication.findOne({
        name: { $regex: cleanBarcode, $options: 'i' },
      });
    }

    if (!medication) {
      const allMeds = await Medication.find({}, { name: 1, barcode: 1, ndc: 1 });
      console.log('Medication lookup failed. Known codes:');
      allMeds.forEach((m) => {
        console.log(`  - ${m.name} | barcode: "${m.barcode}" | ndc: "${m.ndc}"`);
      });

      return res.status(404).json({
        error: 'Medication not found',
        barcode: cleanBarcode,
        suggestion: 'No medication matched this barcode. Check server logs to see what barcodes exist in your database.',
      });
    }

    // Residents' actual prescribed medications live in MedicationLog (created when
    // a schedule is assigned), not the legacy Resident.medications embedded array,
    // which nothing in the app writes to. Only doses still awaiting administration
    // count as a "match" — an already-administered/skipped/missed log shouldn't
    // make the scanner think there's still something to give. 'scheduled' logs are
    // excluded too: the head caregiver hasn't prepared them yet, so a caregiver
    // shouldn't be able to scan-and-administer them early.
    const matchingLogs = await MedicationLog.find({
      medicationId: medication._id,
      status: { $in: ['pending', 'overdue'] },
    })
      .populate('residentId')
      .sort({ scheduledTime: 1 });

    const residentLogMap = new Map();
    matchingLogs.forEach((log) => {
      if (!log.residentId) return;
      const key = String(log.residentId._id);
      if (!residentLogMap.has(key)) {
        residentLogMap.set(key, { resident: log.residentId, log });
      }
    });

    const matchedResidents = [...residentLogMap.values()]
      .map((entry) => entry.resident)
      .filter((resident) => isAssignedToCaregiver(resident, req.user));

    const scanHistory = await ScanHistory.create({
      barcode: cleanBarcode,
      medication: medication._id,
      residents: matchedResidents.map((r) => r._id),
      source: 'database',
      caregiverId: req.user._id,
    });

    res.json({
      success: true,
      medication: {
        id: medication._id,
        barcode: medication.barcode || cleanBarcode,
        name: medication.name,
        genericName: medication.genericName,
        dosage: medication.dosage,
        strength: medication.strength,
        form: medication.form,
        manufacturer: medication.manufacturer,
        purpose: medication.purpose,
        instructions: medication.instructions,
        warnings: medication.warnings,
        sideEffects: medication.sideEffects,
        contraindications: medication.contraindications,
        drugInteractions: medication.drugInteractions,
        pregnancy: medication.pregnancy,
        storage: medication.storage,
        ingredients: medication.ingredients,
      },
      residents: matchedResidents.map((resident) => {
        const log = residentLogMap.get(String(resident._id))?.log;
        return {
          id: resident._id,
          name: resident.fullName || `${resident.firstName || ''} ${resident.lastName || ''}`.trim(),
          room: resident.room || resident.roomNumber,
          bed: resident.bed || '1',
          age: resident.age,
          ward: resident.ward,
          medicationDetails: log
            ? {
                name: log.medicationName,
                dosage: log.dosage,
                frequency: log.frequency,
                scheduleTime: log.scheduledTime,
              }
            : null,
        };
      }),
      scanId: scanHistory._id,
      source: 'database',
      timestamp: scanHistory.createdAt,
    });
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({ error: 'Server error during medication lookup: ' + error.message });
  }
});

// POST /api/medication-scanner/flag — caregiver reports a barcode that
// isn't in the Medication catalog, with up to MAX_FLAG_PHOTOS photos of the
// packaging as evidence. Goes to Head Caregiver for approval before Admin
// ever sees it — see MedicationFlag.js for the full status pipeline.
const MAX_FLAG_PHOTOS = 5;

router.post('/flag', protect, imageUpload.array('photos', MAX_FLAG_PHOTOS), async (req, res) => {
  try {
    // Off-duty staff can't send reports to the Head Caregiver. Checked before
    // any Cloudinary upload so a refused report leaves nothing behind.
    if (!isOnDuty(req.user?.shift)) {
      return res.status(403).json({
        success: false,
        message: 'This action is not available while off duty.',
        accountStatus: 'off_duty',
      });
    }

    const { barcode } = req.body;
    if (!barcode || !String(barcode).trim()) {
      return res.status(400).json({ success: false, message: 'Barcode is required.' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: 'At least one photo of the packaging is required.' });
    }

    const cleanedBarcode = String(barcode).replace(/[\s-]/g, '');
    const stamp = Date.now();
    const results = await Promise.allSettled(
      req.files.map((file, i) => streamUploadFlagPhoto(file.buffer, `flag_${cleanedBarcode}_${stamp}_${i}`))
    );
    const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (uploaded.length !== results.length) {
      // All-or-nothing: don't leave the photos that did upload orphaned in Cloudinary.
      await Promise.all(uploaded.map((u) => cloudinary.uploader.destroy(u.public_id).catch(() => {})));
      return res.status(502).json({ success: false, message: 'Failed to upload the photos. Please try again.' });
    }

    const flag = await MedicationFlag.create({
      barcode: cleanedBarcode,
      photos: uploaded.map((u) => ({ url: u.secure_url, publicId: u.public_id })),
      flaggedBy: req.user._id,
    });

    // Best-effort notify — a failed notification should never fail the
    // flag submission itself.
    try {
      const headCaregivers = await User.find({ role: 'head_caregiver' }, { _id: 1 });
      const recipientIds = headCaregivers.map((u) => String(u._id));
      const flaggerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.username || 'A caregiver';

      const alert = await Alert.create({
        type: 'medication-flag-submitted',
        title: 'Unregistered Medication Flagged',
        message: `${flaggerName} flagged an unrecognized medication (barcode ${cleanedBarcode}).`,
        details: { medicationFlagId: flag._id, barcode: cleanedBarcode },
      });

      const io = req.app.get('io');
      if (io && recipientIds.length) {
        io.to(recipientIds).emit('newAlert', {
          _id: alert._id,
          type: alert.type,
          message: alert.message,
          subMessage: '',
          details: alert.details,
          isRead: false,
        });
      }
    } catch (notifyErr) {
      console.error('Failed to notify head caregivers of medication flag:', notifyErr.message);
    }

    res.status(201).json({ success: true, data: flag });
  } catch (error) {
    console.error('Medication flag error:', error);
    res.status(500).json({ success: false, message: 'Server error while submitting medication flag: ' + error.message });
  }
});

router.get('/last-results', protect, async (req, res) => {
  try {
    const query = canSeeAllScans(req.user) ? {} : { caregiverId: req.user._id };
    const [results, totalCount] = await Promise.all([
      ScanHistory.find(query)
        .populate('medication')
        .populate('residents')
        .sort({ createdAt: -1 })
        .limit(10),
      ScanHistory.countDocuments(query),
    ]);
    res.json({ success: true, results, totalCount });
  } catch (error) {
    console.error('Last scan results error:', error);
    res.status(500).json({ error: 'Server error while getting last scan results: ' + error.message });
  }
});

router.get('/all-results', protect, async (req, res) => {
  try {
    const query = canSeeAllScans(req.user) ? {} : { caregiverId: req.user._id };
    const results = await ScanHistory.find(query)
      .populate('medication')
      .populate('residents')
      .sort({ createdAt: -1 });
    res.json({ success: true, results });
  } catch (error) {
    console.error('All scan results error:', error);
    res.status(500).json({ error: 'Server error while getting all scan results: ' + error.message });
  }
});

router.post('/confirm', protect, async (req, res) => {
  try {
    const { scanId, residentId, medicationName, dosage, notes = '' } = req.body;

    if (!scanId || !residentId || !medicationName) {
      return res.status(400).json({ success: false, error: 'scanId, residentId and medicationName are required.' });
    }

    const scanHistory = await ScanHistory.findById(scanId);
    if (!scanHistory) {
      return res.status(404).json({ success: false, error: 'Scan history not found.' });
    }

    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found.' });
    }

    const matchLower = medicationName.toLowerCase();
    const embeddedMedication = resident.medications.find((med) => {
      const medName = med.name?.toLowerCase() || '';
      return medName.includes(matchLower) || matchLower.includes(medName);
    });

    if (embeddedMedication) {
      embeddedMedication.status = 'administered';
      embeddedMedication.lastAdministered = new Date();
      await resident.save();

      logAudit(req, {
        action: 'MEDICATION_ADMINISTERED',
        module: 'Medication',
        description: `${embeddedMedication.name || medicationName} administered (scan) for ${resident.fullName || `${resident.firstName || ''} ${resident.lastName || ''}`.trim()}`,
        targetId: resident._id,
        targetLabel: resident.fullName || `${resident.firstName || ''} ${resident.lastName || ''}`.trim(),
        targetModel: 'Resident',
      });
    }

    scanHistory.status = 'confirmed';
    scanHistory.notes = notes;
    await scanHistory.save();

    res.json({
      success: true,
      message: 'Medication scan confirmed.',
      scanHistory,
      resident: {
        id: resident._id,
        name: resident.fullName || `${resident.firstName || ''} ${resident.lastName || ''}`.trim(),
        room: resident.room || resident.roomNumber,
        bed: resident.bed,
        medications: resident.medications
      }
    });
  } catch (error) {
    console.error('Confirm scan error:', error);
    res.status(500).json({ success: false, error: 'Server error while confirming medication scan.' });
  }
});

module.exports = router;
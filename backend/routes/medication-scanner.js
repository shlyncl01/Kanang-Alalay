const express = require('express');
const router = express.Router();

const Medication = require('../models/Medication');
const Resident = require('../models/Resident');
const MedicationLog = require('../models/MedicationLog');
const ScanHistory = require('../models/ScanHistory');
const { protect } = require('../middleware/authMiddleware');

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
    // which nothing in the app writes to.
    const matchingLogs = await MedicationLog.find({ medicationId: medication._id })
      .populate('residentId')
      .sort({ scheduledTime: -1 });

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

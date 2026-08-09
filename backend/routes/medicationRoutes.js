const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const MedicationLog = require('../models/MedicationLog');
const Medication = require('../models/Medication');
const Resident = require('../models/Resident');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { getManilaDayBounds } = require('../utils/dateHelpers');

// Get all medications
router.get('/', authMiddleware, async (req, res) => {
    try {
        const medications = await Medication.find().sort({ name: 1 });
        res.json({ success: true, data: medications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching medications' });
    }
});

// Get today's medication schedule for caregiver
router.get('/schedule', authMiddleware, async (req, res) => {
    try {
        const { today, tomorrow } = getManilaDayBounds();

        const logs = await MedicationLog.find({
            caregiverId: req.user._id,
            scheduledTime: { $gte: today, $lt: tomorrow },
            // 'scheduled' means not yet prepared by the head caregiver — only surface
            // once prepared ('pending') or overdue.
            status: { $in: ['pending', 'overdue'] }
        })
        .populate('residentId', 'firstName lastName roomNumber')
        .populate('medicationId', 'name dosage form')
        .sort({ scheduledTime: 1 });

        res.json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get active medications for a resident
router.get('/resident/:residentId', authMiddleware, async (req, res) => {
    try {
        const residentId = req.params.residentId;
        const logs = await MedicationLog.find({
            residentId,
            status: { $in: ['pending', 'overdue'] }
        })
        .populate('medicationId', 'name dosage form uniqueCode medicationId stock')
        .sort({ scheduledTime: 1 });

        const medications = logs.map(log => ({
            _id: log.medicationId?._id || log._id,
            medicationId: log.medicationId?.medicationId || '',
            uniqueCode: log.medicationId?.uniqueCode || '',
            name: log.medicationName || log.medicationId?.name || '',
            dosage: log.dosage || (log.medicationId?.dosage ? `${log.medicationId.dosage.value}${log.medicationId.dosage.unit}` : ''),
            form: log.medicationId?.form || '',
            stock: log.medicationId?.stock || {},
            scheduleTime: log.scheduledTime
                ? new Date(log.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Scheduled',
            status: log.status || 'scheduled',
            logId: log._id,
        }));

        res.json({ success: true, data: medications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching resident medications' });
    }
});

// Get medication by ID, medicationId, or QR code
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const queryValue = req.params.id;
        const query = {
            $or: [
                { _id: mongoose.Types.ObjectId.isValid(queryValue) ? queryValue : null },
                { medicationId: queryValue.toUpperCase() },
                { uniqueCode: queryValue.toUpperCase() },
                { barcode: queryValue }
            ].filter(Boolean)
        };

        const medication = await Medication.findOne(query);
        if (!medication) {
            return res.status(404).json({ success: false, message: 'Medication not found' });
        }
        res.json({ success: true, data: medication });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching medication' });
    }
});

// Create new medication with QR code and stock settings
router.post('/', authMiddleware, roleMiddleware('admin', 'head_caregiver'), async (req, res) => {
    try {
        const {
            medicationId,
            uniqueCode,
            barcode,
            name,
            genericName,
            dosage,
            strength,
            form,
            route,
            manufacturer,
            ndc,
            purpose,
            instructions,
            warnings,
            sideEffects,
            contraindications,
            drugInteractions,
            pregnancy,
            storage,
            stock,
            expiryDate,
            isActive,
            phAvailability
        } = req.body;

        if (!barcode || !String(barcode).trim()) {
            return res.status(400).json({ success: false, message: 'Barcode is required.' });
        }

        const availability = phAvailability || 'available';
        if (!['available', 'banned', 'discontinued', 'unavailable'].includes(availability)) {
            return res.status(400).json({ success: false, message: 'Invalid availability status.' });
        }
        if (availability !== 'available') {
            return res.status(400).json({ success: false, message: 'Cannot add medications that are banned, discontinued, or unavailable in the Philippines.' });
        }

        const normalizedNameCode = name ? name.trim().replace(/\s+/g, '_').toUpperCase() : null;
        const safeMedicationId = (medicationId || normalizedNameCode || `MED-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`).toUpperCase();
        const safeUniqueCode = (uniqueCode || barcode || normalizedNameCode || safeMedicationId).toUpperCase();

        const medication = new Medication({
            medicationId: safeMedicationId,
            uniqueCode: safeUniqueCode,
            barcode,
            phAvailability: availability,
            name,
            genericName,
            dosage,
            strength,
            form,
            route,
            manufacturer,
            ndc,
            purpose,
            instructions,
            warnings,
            sideEffects,
            contraindications,
            drugInteractions,
            pregnancy,
            storage,
            stock: {
                current: stock?.current ?? 0,
                minimum: stock?.minimum ?? 10,
                maximum: stock?.maximum ?? 100,
                unit: stock?.unit || ''
            },
            expiryDate,
            isActive: isActive !== false
        });

        await medication.save();
        res.status(201).json({ success: true, data: medication });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Medication ID or QR code already exists.' });
        }
        res.status(500).json({ success: false, message: 'Server error creating medication' });
    }
});

// Update medication details and stock settings
router.put('/:id', authMiddleware, roleMiddleware('admin', 'head_caregiver'), async (req, res) => {
    try {
        const update = { ...req.body };
        if (update.uniqueCode) update.uniqueCode = update.uniqueCode.toUpperCase();
        if (update.medicationId) update.medicationId = update.medicationId.toUpperCase();

        const medication = await Medication.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true
        });

        if (!medication) return res.status(404).json({ success: false, message: 'Medication not found' });
        res.json({ success: true, data: medication });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error updating medication' });
    }
});

// Adjust stock count for a medication
router.post('/:id/stock', authMiddleware, roleMiddleware('head_caregiver'), async (req, res) => {
    try {
        const { amount, setTo } = req.body;
        if (amount === undefined && setTo === undefined) {
            return res.status(400).json({ success: false, message: 'Stock amount or setTo value is required.' });
        }

        const update = {};
        if (typeof amount === 'number') {
            update.$inc = { 'stock.current': amount };
        }
        if (typeof setTo === 'number') {
            update.$set = { 'stock.current': setTo };
        }

        const medication = await Medication.findByIdAndUpdate(req.params.id, update, {
            new: true,
            runValidators: true
        });

        if (!medication) return res.status(404).json({ success: false, message: 'Medication not found' });
        res.json({ success: true, data: medication });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error updating stock' });
    }
});

// Scan a QR code and decrement medication stock directly
router.post('/scan', authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, message: 'Scan code is required.' });

        const scanCode = code.toUpperCase();
        const medication = await Medication.findOne({
            $or: [
                { medicationId: scanCode },
                { uniqueCode: scanCode },
                { barcode: scanCode },
                { _id: mongoose.Types.ObjectId.isValid(scanCode) ? scanCode : null }
            ].filter(Boolean)
        });

        if (!medication) {
            return res.status(404).json({ success: false, message: 'Medication not found for provided code.' });
        }

        if (medication.stock.current <= 0) {
            return res.status(400).json({ success: false, message: 'Medication stock is depleted.' });
        }

        medication.stock.current -= 1;
        await medication.save();

        res.json({ success: true, data: medication, message: 'Medication scanned and stock decremented.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error while processing scan.' });
    }
});

router.post('/administer', authMiddleware, async (req, res) => {
    try {
        const {
            residentId,
            medicationId,
            medicationName,
            dosage,
            scanId,
            administeredAt,
            status,
            notes
        } = req.body;

        if (!residentId || !medicationId || !medicationName) {
            return res.status(400).json({ success: false, message: 'residentId, medicationId, and medicationName are required.' });
        }

        const resident = await Resident.findById(residentId);
        if (!resident) {
            return res.status(404).json({ success: false, message: 'Resident not found.' });
        }

        const medication = await Medication.findById(medicationId);
        if (medication && medication.stock?.current > 0) {
            medication.stock.current -= 1;
            await medication.save();
        }

        if (resident.medications && resident.medications.id(medicationId)) {
            const embeddedMed = resident.medications.id(medicationId);
            embeddedMed.status = 'administered';
            embeddedMed.lastAdministered = administeredAt ? new Date(administeredAt) : new Date();
            await resident.save();
        }

        const log = new MedicationLog({
            logId: `MEDLOG-${Date.now().toString().slice(-6)}`,
            residentId,
            medicationId,
            caregiverId: req.user._id,
            residentName: resident.name || `${resident.firstName} ${resident.lastName}`.trim(),
            medicationName,
            room: resident.room || resident.roomNumber || '',
            bed: resident.bed || '',
            dosage: typeof dosage === 'string' && dosage.trim() ? dosage : (dosage?.value ? `${dosage.value}${dosage.unit || ''}` : 'N/A'),
            status: status || 'administered',
            administeredTime: administeredAt ? new Date(administeredAt) : new Date(),
            scheduledTime: administeredAt ? new Date(administeredAt) : undefined,
            notes: notes || '',
            verificationMethod: scanId ? 'scan' : 'manual',
            scanData: scanId ? { medicationCode: scanId, scanTime: new Date(), match: true } : undefined
        });

        await log.save();

        res.json({ success: true, data: log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to administer medication.' });
    }
});

router.get('/history/:residentId', authMiddleware, async (req, res) => {
    try {
        const history = await MedicationLog.find({ residentId: req.params.residentId }).sort({ administeredTime: -1 });
        res.json({ success: true, data: history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch medication history.' });
    }
});

router.post('/delay', authMiddleware, async (req, res) => {
    try {
        const { residentId, medicationId, medicationName, reason, duration, scanId, delayedUntil } = req.body;
        if (!residentId || !medicationId || !medicationName) {
            return res.status(400).json({ success: false, message: 'residentId, medicationId, and medicationName are required.' });
        }

        const resident = await Resident.findById(residentId);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found.' });

        const log = new MedicationLog({
            logId: `MEDLOG-${Date.now().toString().slice(-6)}`,
            residentId,
            medicationId,
            caregiverId: req.user._id,
            residentName: resident.name || `${resident.firstName} ${resident.lastName}`.trim(),
            medicationName,
            room: resident.room || resident.roomNumber || '',
            bed: resident.bed || '',
            dosage: duration || '',
            status: 'pending',
            scheduledTime: delayedUntil ? new Date(delayedUntil) : undefined,
            notes: `Delayed: ${reason || 'No reason provided'}`,
            verificationMethod: scanId ? 'scan' : 'manual',
            scanData: scanId ? { medicationCode: scanId, scanTime: new Date(), match: true } : undefined
        });
        await log.save();
        res.json({ success: true, data: log });
    } catch (error) {
        console.error('Delay medication error:', error);
        res.status(500).json({ success: false, message: 'Failed to record medication delay.' });
    }
});

router.post('/refuse', authMiddleware, async (req, res) => {
    try {
        const { residentId, medicationId, medicationName, reason, notes, doctorNotified, scanId } = req.body;
        if (!residentId || !medicationId || !medicationName) {
            return res.status(400).json({ success: false, message: 'residentId, medicationId, and medicationName are required.' });
        }

        const resident = await Resident.findById(residentId);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found.' });

        const log = new MedicationLog({
            logId: `MEDLOG-${Date.now().toString().slice(-6)}`,
            residentId,
            medicationId,
            caregiverId: req.user._id,
            residentName: resident.name || `${resident.firstName} ${resident.lastName}`.trim(),
            medicationName,
            room: resident.room || resident.roomNumber || '',
            bed: resident.bed || '',
            dosage: 'N/A',
            status: 'skipped',
            notes: `Refusal: ${reason || 'No reason provided'}. ${notes || ''} ${doctorNotified ? 'Doctor notified.' : ''}`.trim(),
            verificationMethod: scanId ? 'scan' : 'manual',
            scanData: scanId ? { medicationCode: scanId, scanTime: new Date(), match: true } : undefined
        });
        await log.save();
        res.json({ success: true, data: log });
    } catch (error) {
        console.error('Refuse medication error:', error);
        res.status(500).json({ success: false, message: 'Failed to record medication refusal.' });
    }
});

router.post('/side-effect', authMiddleware, async (req, res) => {
    try {
        const { residentId, medicationId, medicationName, symptoms, severity, doctorNotified, emergencyProtocol, scanId } = req.body;
        if (!residentId || !medicationId || !medicationName) {
            return res.status(400).json({ success: false, message: 'residentId, medicationId, and medicationName are required.' });
        }

        const resident = await Resident.findById(residentId);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found.' });

        const log = new MedicationLog({
            logId: `MEDLOG-${Date.now().toString().slice(-6)}`,
            residentId,
            medicationId,
            caregiverId: req.user._id,
            residentName: resident.name || `${resident.firstName} ${resident.lastName}`.trim(),
            medicationName,
            room: resident.room || resident.roomNumber || '',
            bed: resident.bed || '',
            dosage: 'N/A',
            status: 'missed',
            notes: `Symptoms: ${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms || 'None'}. Severity: ${severity || 'unknown'}. ${doctorNotified ? 'Doctor notified.' : ''} ${emergencyProtocol ? 'Emergency protocol activated.' : ''}`.trim(),
            verificationMethod: scanId ? 'scan' : 'manual',
            scanData: scanId ? { medicationCode: scanId, scanTime: new Date(), match: true } : undefined
        });
        await log.save();
        res.json({ success: true, data: log });
    } catch (error) {
        console.error('Side effect error:', error);
        res.status(500).json({ success: false, message: 'Failed to record side effect.' });
    }
});

// Administer medication (with optional scanning)
router.post('/administer/:logId', authMiddleware, async (req, res) => {
    try {
        const { verificationMethod, scanData, notes } = req.body;
        const log = await MedicationLog.findById(req.params.logId);

        if (!log) {
            return res.status(404).json({ message: 'Medication log not found' });
        }

        // Verify scan if provided
        if (verificationMethod === 'scan' && scanData) {
            const medication = await Medication.findById(log.medicationId);
            const isMatch = scanData.medicationCode === medication.uniqueCode;
            
            if (!isMatch) {
                return res.status(400).json({ 
                    message: 'Medication scan mismatch!',
                    expected: medication.name,
                    scanned: scanData.medicationCode
                });
            }

            log.scanData = {
                medicationCode: scanData.medicationCode,
                scanTime: new Date(),
                match: true
            };
        }

        // Update inventory
        await Medication.findByIdAndUpdate(log.medicationId, {
            $inc: { 'stock.current': -1 }
        });

        // Update log
        log.status = 'administered';
        log.administeredTime = new Date();
        log.verificationMethod = verificationMethod;
        log.administeredBy = req.user._id;
        if (notes) log.notes = notes;

        await log.save();

        res.json({ 
            message: 'Medication administered successfully',
            log 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Voice prompt system
router.post('/voice-prompt/:logId', authMiddleware, async (req, res) => {
    try {
        const log = await MedicationLog.findById(req.params.logId);
        
        if (!log) {
            return res.status(404).json({ message: 'Log not found' });
        }

        log.voicePrompt = {
            played: true,
            playedAt: new Date(),
            language: req.body.language || 'filipino'
        };

        await log.save();

        // Generate voice prompt text
        const resident = await Resident.findById(log.residentId);
        const medication = await Medication.findById(log.medicationId);

        const prompt = {
            message: `Time for medication. Resident: ${resident.firstName}. Medication: ${medication.name}. Dosage: ${medication.dosage}.`,
            language: log.voicePrompt.language,
            time: new Date().toLocaleTimeString()
        };

        res.json({ prompt });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
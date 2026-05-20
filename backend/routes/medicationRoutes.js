const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const MedicationLog = require('../models/MedicationLog');
const Medication = require('../models/Medication');
const Resident = require('../models/Resident');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const logs = await MedicationLog.find({
            caregiverId: req.user._id,
            scheduledTime: { $gte: today, $lt: tomorrow },
            status: { $in: ['scheduled', 'overdue'] }
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
            status: { $in: ['scheduled', 'overdue'] }
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
            logId: log._id
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
            isActive
        } = req.body;

        const normalizedNameCode = name ? name.trim().replace(/\s+/g, '_').toUpperCase() : null;
        const safeMedicationId = (medicationId || normalizedNameCode || `MED-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`).toUpperCase();
        const safeUniqueCode = (uniqueCode || barcode || normalizedNameCode || safeMedicationId).toUpperCase();

        const medication = new Medication({
            medicationId: safeMedicationId,
            uniqueCode: safeUniqueCode,
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

        const scanCode = code.toString().trim();
        const scanCodeUpper = scanCode.toUpperCase();
        const medication = await Medication.findOne({
            $or: [
                { medicationId: scanCodeUpper },
                { uniqueCode: scanCodeUpper },
                { barcode: scanCode },
                { barcode: scanCodeUpper },
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
        log.caregiverId = req.user._id;
        log.notes = notes;

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
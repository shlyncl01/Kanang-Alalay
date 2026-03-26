const express = require('express');
const router = express.Router();
const MedicationLog = require('../models/MedicationLog');
const Medication = require('../models/Medication');
const Resident = require('../models/Resident');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

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
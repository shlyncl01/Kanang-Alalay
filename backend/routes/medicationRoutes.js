const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const MedicationLog = require('../models/MedicationLog');
const Medication = require('../models/Medication');
const Resident = require('../models/Resident');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { getManilaDayBounds, parseManilaDateTime } = require('../utils/dateHelpers');
const { notifyCaregiverAndOverseers } = require('../services/alertService');

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

// Delete medication (archive)
router.delete('/:id', authMiddleware, roleMiddleware('admin', 'head_caregiver'), async (req, res) => {
    try {
        const medication = await Medication.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!medication) return res.status(404).json({ success: false, message: 'Medication not found' });
        res.json({ success: true, message: 'Medication archived', data: medication });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error deleting medication' });
    }
});

// Get medication logs
router.get('/logs/today', authMiddleware, async (req, res) => {
    try {
        const { today, tomorrow } = getManilaDayBounds();
        const logs = await MedicationLog.find({
            scheduledTime: { $gte: today, $lt: tomorrow }
        })
        .populate('residentId', 'firstName lastName')
        .populate('medicationId', 'name dosage')
        .sort({ scheduledTime: -1 });

        res.json({ success: true, data: logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching logs' });
    }
});

// Record medication delivery (mark as pending by head caregiver)
router.post('/prepare/:residentId', authMiddleware, roleMiddleware('head_caregiver'), async (req, res) => {
    try {
        const { medicationId, medicationName, dosage, scheduledTime, instructions } = req.body;
        if (!residentId || !medicationId || !medicationName) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const resident = await Resident.findById(req.params.residentId);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });

        const log = new MedicationLog({
            logId: `MEDLOG-${Date.now().toString().slice(-6)}`,
            residentId: req.params.residentId,
            medicationId,
            caregiverId: req.user._id,
            residentName: resident.name || `${resident.firstName} ${resident.lastName}`.trim(),
            medicationName,
            room: resident.room || resident.roomNumber || '',
            bed: resident.bed || '',
            floor: resident.floor || '',
            dosage,
            scheduledTime: parseManilaDateTime(scheduledTime),
            status: 'pending',
            notes: instructions || ''
        });

        await log.save();
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        console.error('Prepare medication error:', error);
        res.status(500).json({ success: false, message: 'Failed to prepare medication' });
    }
});

// Skip/hold medication dose
router.post('/hold', authMiddleware, async (req, res) => {
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
            notes: `Hold: ${reason || 'No reason provided'}. ${notes || ''} ${doctorNotified ? 'Doctor notified.' : ''}`.trim(),
            verificationMethod: scanId ? 'scan' : 'manual',
            scanData: scanId ? { medicationCode: scanId, scanTime: new Date(), match: true } : undefined
        });
        await log.save();
        res.json({ success: true, data: log });
    } catch (error) {
        console.error('Hold medication error:', error);
        res.status(500).json({ success: false, message: 'Failed to record medication hold.' });
    }
});

// Delay medication dose
router.post('/delay', authMiddleware, async (req, res) => {
    try {
        const { residentId, medicationId, medicationName, reason, notes, delayedUntil, scanId } = req.body;
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
            status: 'pending',
            scheduledTime: delayedUntil ? parseManilaDateTime(delayedUntil) : undefined,
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

// Get a single medication log's current status
router.get('/log/:logId', authMiddleware, async (req, res) => {
    try {
        const log = await MedicationLog.findById(req.params.logId);
        if (!log) return res.status(404).json({ success: false, message: 'Medication log not found' });
        res.json({ success: true, data: log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching medication log' });
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

        notifyCaregiverAndOverseers(req.app.get('io'), {
            type: 'medication-administered',
            title: 'Medication Administered',
            message: `${log.medicationName || 'Medication'} for ${log.residentName || 'resident'}`,
            caregiverId: log.caregiverId,
            details: {
                subMessage: `Given by ${[req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.username || 'caregiver'}`,
                residentId: log.residentId,
                medicationId: log.medicationId,
                logId: log._id,
            },
        }).catch((err) => console.error('[Alert] Failed to notify administered:', err.message));

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

// ══════════════════════════════════════════════════════════════════════════════
// ── NEW COMPLIANCE STATISTICS ENDPOINTS ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Get compliance statistics for today (or custom date range)
router.get('/compliance/stats', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate, facilityId } = req.query;
        
        // Default to today (Manila time)
        const { today, tomorrow } = getManilaDayBounds();
        const start = startDate ? new Date(startDate) : today;
        const end = endDate ? new Date(endDate) : tomorrow;

        // Match query: all logs in the date range
        const matchQuery = {
            scheduledTime: { $gte: start, $lt: end }
        };

        // Aggregate by status
        const statusBreakdown = await MedicationLog.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Convert to object for easier access
        const statusCounts = {};
        statusBreakdown.forEach(item => {
            statusCounts[item._id] = item.count;
        });

        // Calculate compliance metrics
        const scheduled = statusCounts['scheduled'] || statusCounts['pending'] || 0;
        const administered = statusCounts['administered'] || 0;
        const missed = statusCounts['missed'] || 0;
        const overdue = statusCounts['overdue'] || 0;
        const skipped = statusCounts['skipped'] || 0;
        const delayed = statusCounts['delayed'] || 0;

        // Compliance rate = administered / (scheduled + administered + missed + overdue)
        // i.e., of doses that had a chance to be given, how many were actually given
        const totalOpportunities = scheduled + administered + missed + overdue;
        const complianceRate = totalOpportunities > 0 
            ? Math.round((administered / totalOpportunities) * 100) 
            : 0;

        // Daily breakdown for weekly chart (last 7 days)
        const dailyStats = await MedicationLog.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' }
                    },
                    total: { $sum: 1 },
                    administered: {
                        $sum: { $cond: [{ $eq: ['$status', 'administered'] }, 1, 0] }
                    },
                    missed: {
                        $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
                    },
                    overdue: {
                        $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Calculate daily compliance rates
        const dailyCompliance = dailyStats.map(day => ({
            date: day._id,
            total: day.total,
            administered: day.administered,
            missed: day.missed,
            overdue: day.overdue,
            rate: day.total > 0 
                ? Math.round((day.administered / (day.administered + day.missed + day.overdue)) * 100)
                : 0
        }));

        res.json({
            success: true,
            stats: {
                complianceRate,
                scheduled,
                administered,
                missed,
                overdue,
                skipped,
                delayed,
                totalOpportunities,
                dateRange: { start, end }
            },
            dailyBreakdown: dailyCompliance
        });

    } catch (error) {
        console.error('Compliance stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch compliance statistics' 
        });
    }
});

// Get compliance summary by resident
router.get('/compliance/by-resident', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const { today, tomorrow } = getManilaDayBounds();
        const start = startDate ? new Date(startDate) : today;
        const end = endDate ? new Date(endDate) : tomorrow;

        const residentStats = await MedicationLog.aggregate([
            {
                $match: {
                    scheduledTime: { $gte: start, $lt: end }
                }
            },
            {
                $group: {
                    _id: '$residentId',
                    residentName: { $first: '$residentName' },
                    room: { $first: '$room' },
                    total: { $sum: 1 },
                    administered: {
                        $sum: { $cond: [{ $eq: ['$status', 'administered'] }, 1, 0] }
                    },
                    missed: {
                        $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
                    },
                    overdue: {
                        $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    complianceRate: {
                        $cond: [
                            { $gt: ['$total', 0] },
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ['$administered', '$total'] },
                                            100
                                        ]
                                    }
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            { $sort: { complianceRate: -1 } }
        ]);

        res.json({
            success: true,
            residents: residentStats,
            dateRange: { start, end }
        });

    } catch (error) {
        console.error('Resident compliance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch resident compliance' 
        });
    }
});

module.exports = router;
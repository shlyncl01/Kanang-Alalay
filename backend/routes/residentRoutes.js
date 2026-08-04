const express  = require('express');
const router   = express.Router();
const Resident = require('../models/Resident');
const VitalsLog = require('../models/VitalsLog');
const { protect, adminOnly } = require('../middleware/authMiddleware');

function parseVitalNumber(value, label, min, max, errors) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (normalized === '') return null;
    const number = Number(normalized);
    if (!Number.isFinite(number)) {
        errors.push(`${label} must be a number.`);
        return null;
    }
    if (number < min || number > max) {
        errors.push(`${label} must be between ${min} and ${max}.`);
        return null;
    }
    return number;
}

function validateVitalsInput(body) {
    const errors = [];
    const bloodPressure = String(body.bloodPressure || '').trim();
    const notes = String(body.notes || '').trim();

    if (bloodPressure) {
        if (!/^\d{2,3}\/\d{2,3}$/.test(bloodPressure)) {
            errors.push('Blood pressure must be in format 120/80.');
        } else {
            const [systolic, diastolic] = bloodPressure.split('/').map(Number);
            if (systolic < 60 || systolic > 250) errors.push('Systolic blood pressure must be between 60 and 250.');
            if (diastolic < 30 || diastolic > 150) errors.push('Diastolic blood pressure must be between 30 and 150.');
            if (systolic <= diastolic) errors.push('Systolic blood pressure must be higher than diastolic.');
        }
    }

    const vitals = {
        bloodPressure,
        heartRate: parseVitalNumber(body.heartRate, 'Heart rate', 20, 300, errors),
        temperature: parseVitalNumber(body.temperature, 'Temperature', 30, 45, errors),
        oxygenSat: parseVitalNumber(body.oxygenSat, 'Oxygen saturation', 50, 100, errors),
        weight: parseVitalNumber(body.weight, 'Weight', 1, 300, errors),
        notes,
    };

    if (notes.length > 500) errors.push('Notes must be 500 characters or fewer.');
    const hasAnyVital = bloodPressure || vitals.heartRate !== null || vitals.temperature !== null || vitals.oxygenSat !== null || vitals.weight !== null;
    if (!hasAnyVital) errors.push('Please provide at least one vital sign.');

    return { errors, vitals };
}

async function saveResidentVitals(resident, userId, cleanVitals) {
    const vitals = new VitalsLog({
        residentId: resident._id,
        loggedBy: userId,
        ...cleanVitals,
    });
    await vitals.save();

    const vitalSnapshot = {
        ...cleanVitals,
        loggedAt: vitals.createdAt || new Date(),
        loggedBy: userId,
    };

    resident.latestVitals = vitalSnapshot;
    resident.vitalLogs = resident.vitalLogs || [];
    resident.vitalLogs.push(vitalSnapshot);

    const { heartRate, temperature, oxygenSat } = cleanVitals;
    let alertLevel = resident.alertLevel || 'stable';
    if ((temperature !== null && temperature > 38.5) || (heartRate !== null && heartRate > 100) || (oxygenSat !== null && oxygenSat < 94)) {
        alertLevel = 'alert';
    }
    if ((temperature !== null && temperature > 39.5) || (heartRate !== null && heartRate > 120) || (oxygenSat !== null && oxygenSat < 90)) {
        alertLevel = 'critical';
    }
    resident.alertLevel = alertLevel;
    await resident.save();

    return vitals;
}
// GET /api/residents  — all active residents (any authenticated user)
router.get('/', protect, async (req, res) => {
    try {
        const residents = await Resident.find({ status: 'active' })
            .sort({ roomNumber: 1 });
        res.json({ success: true, data: residents, count: residents.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/residents/assigned  — residents assigned to logged-in user
router.get('/assigned', protect, async (req, res) => {
    try {
        const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
        const query = ['admin', 'head_caregiver'].includes(req.user.role)
            ? { status: 'active' }
            : {
                status: 'active',
                $or: [
                    { primaryCaregiverId: req.user._id },
                    { primaryCaregiverName: userName },
                    { primaryCaregiver: userName },
                    { assignedNurse: userName },
                    { assignedCaregiver: userName },
                    { 'assignedStaff.primaryCaregiverId': req.user._id },
                    { 'assignedStaff.primaryCaregiverName': userName },
                    { 'assignedStaff.primaryCaregiver': userName },
                    { 'assignedStaff.assignedNurse': userName },
                    { 'assignedStaff.assignedCaregiver': userName }
                ]
            };

        const residents = await Resident.find(query).sort({ roomNumber: 1 });
        res.json({ success: true, data: residents, count: residents.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching assigned residents' });
    }
});

router.get('/:id/care-notes', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
        res.json({ success: true, data: resident.careNotes || [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching care notes' });
    }
});

router.post('/:id/care-notes', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
        const note = {
            note: req.body.note,
            nurseName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}`.trim() : 'Nurse'
        };
        resident.careNotes = resident.careNotes || [];
        resident.careNotes.push(note);
        await resident.save();
        res.json({ success: true, data: resident.careNotes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error adding care note' });
    }
});

router.put('/:id/care-notes/:noteId', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
        const note = resident.careNotes.id(req.params.noteId);
        if (!note) return res.status(404).json({ success: false, message: 'Care note not found' });
        note.note = req.body.note || note.note;
        await resident.save();
        res.json({ success: true, data: resident.careNotes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error updating care note' });
    }
});

router.delete('/:id/care-notes/:noteId', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
        const note = resident.careNotes.id(req.params.noteId);
        if (!note) return res.status(404).json({ success: false, message: 'Care note not found' });
        note.deleteOne();
        await resident.save();
        res.json({ success: true, data: resident.careNotes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error deleting care note' });
    }
});

router.post('/:id/administer/:medId', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });

        const medication = resident.medications.id(req.params.medId);
        if (!medication) {
            return res.status(404).json({ success: false, message: 'Embedded medication not found' });
        }

        medication.status = 'administered';
        medication.lastAdministered = req.body.administeredAt ? new Date(req.body.administeredAt) : new Date();
        await resident.save();

        res.json({ success: true, data: medication });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error administering medication' });
    }
});

router.post('/:id/vitals', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });

        const { errors, vitals: cleanVitals } = validateVitalsInput(req.body || {});
        if (errors.length) return res.status(400).json({ success: false, message: errors[0], errors });

        const vitals = await saveResidentVitals(resident, req.user._id, cleanVitals);
        res.status(201).json({ success: true, data: vitals });
    } catch (error) {
        console.error('Resident vitals create error:', error);
        res.status(500).json({ success: false, message: 'Server error saving vitals' });
    }
});

router.get('/:id/vitals', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });

        const vitals = await VitalsLog.find({ residentId: resident._id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json({ success: true, data: vitals });
    } catch (error) {
        console.error('Resident vitals fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching vitals' });
    }
});
// GET /api/residents/statistics
router.get('/statistics', protect, async (req, res) => {
    try {
        const totalResidents = await Resident.countDocuments({ status: 'active' });

        const averageAgeAgg = await Resident.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: null, avgAge: { $avg: '$age' } } }
        ]);

        const conditionStats = await Resident.aggregate([
            { $match: { status: 'active' } },
            { $unwind: '$medicalConditions' },
            { $group: { _id: '$medicalConditions.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            data: {
                totalResidents,
                averageAge:   averageAgeAgg[0]?.avgAge || 0,
                conditionStats
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/residents/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
        res.json({ success: true, data: resident });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/residents  — admin only
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const residentId = 'RES' + Date.now().toString().slice(-6);

        const resident = new Resident({ residentId, ...req.body });
        await resident.save();

        res.status(201).json({ success: true, data: resident });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Resident ID already exists.' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /api/residents/:id  — admin only
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        const resident = await Resident.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });

        res.json({ success: true, data: resident });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /api/residents/:id  — admin only
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const resident = await Resident.findByIdAndDelete(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
        res.json({ success: true, message: 'Resident deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

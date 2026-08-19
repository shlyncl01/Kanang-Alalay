const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Resident = require('../models/Resident');
const Medication = require('../models/Medication');
const MedicationLog = require('../models/MedicationLog');
const Inventory = require('../models/Inventory');
const StockRequest = require('../models/StockRequest');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { startOfManilaDay, parseManilaDateTime } = require('../utils/dateHelpers');

router.use(protect);

// How long a dose can sit "overdue" (i.e. shown as Delayed) before it
// automatically escalates to "missed". Adjust to match clinical policy.
const MISSED_GRACE_MINUTES = 60;

function requireHeadCaregiver(req, res) {
    if (req.user?.role !== 'head_caregiver') {
        res.status(403).json({
            success: false,
            message: 'Only a head caregiver can assign caregivers to residents.'
        });
        return false;
    }
    return true;
}

function shapeResident(r) {
    return {
        _id: r._id,
        residentId: r.residentId,
        name: `${r.firstName} ${r.lastName}`.trim(),
        firstName: r.firstName,
        lastName: r.lastName,
        nickname: r.nickname || '',
        age: r.age,
        gender: r.gender,
        room: r.roomNumber,
        floor: r.floor || '',
        bed: r.bed || '',
        conditions: (r.medicalConditions || []).map(c => c.name || c),
        alertLevel: r.alertLevel || 'stable',
        medicationOverdue: r.medicationOverdue || false,
        overdueMed: r.overdueMed || '',
        overdueAt: r.overdueAt || null,
        nextMed: r.nextMed || '',
        primaryCaregiver: r.primaryCaregiver,
        primaryCaregiverName: r.primaryCaregiverName,
        primaryCaregiverId: r.primaryCaregiverId,
        assignedCaregiver: r.assignedCaregiver || r.assignedStaff?.assignedCaregiver || '',
        assignedStaff: r.assignedStaff || {},
        status: r.status,
        admissionDate: r.admissionDate || null,
        discharge: r.discharge || null,
    };
}

function shapeLog(l) {
    const r = l.residentId;
    const m = l.medicationId;
    const isPopulated = r && typeof r === 'object';

    return {
        _id: l._id,
        logId: l.logId,
        residentId: isPopulated ? r._id : l.residentId,
        residentName: l.residentName || (isPopulated ? `${r.firstName} ${r.lastName}` : '—'),
        medicationId: isPopulated && m ? m._id : l.medicationId,
        medicationName: l.medicationName || (isPopulated && m ? m.name : '—'),
        room: l.room || (isPopulated ? r.roomNumber || '' : ''),
        floor: l.floor || (isPopulated ? r.floor || '' : ''),
        bed: l.bed || (isPopulated ? r.bed || '' : ''),
        condition: l.condition || (isPopulated && m ? m.purpose || '' : ''),
        dosage: l.dosage || (isPopulated && m && m.dosage ? `${m.dosage.value}${m.dosage.unit}` : ''),
        frequency: l.frequency || '',
        nextDose: l.nextDose || '',
        scheduledTime: l.scheduledTime,
        administeredTime: l.administeredTime,
        status: l.status,
        notes: l.notes || '',
        verificationMethod: l.verificationMethod,
    };
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeId(value) {
    if (!value) return '';
    if (typeof value === 'object') return String(value._id || value.id || '');
    return String(value);
}

function getCaregiverName(caregiver) {
    return `${caregiver.firstName || ''} ${caregiver.lastName || ''}`.trim();
}

async function findAssignableCaregiver(caregiverId) {
    const id = normalizeId(caregiverId);
    if (!id) return null;
    const query = {
        role: /^caregiver$/i,
        status: { $nin: ['terminated', 'deactivated', 'Terminated', 'Deactivated'] }
    };
    if (mongoose.Types.ObjectId.isValid(id)) {
        return User.findOne({ _id: id, ...query });
    }
    return User.findOne({
        ...query,
        $or: [
            { staffId: id },
            { email: new RegExp(`^${escapeRegex(id)}$`, 'i') },
            { username: new RegExp(`^${escapeRegex(id)}$`, 'i') }
        ]
    });
}
// Discharged/deceased/transferred residents keep their MedicationLog history
// for audit purposes (see Resident.discharge comment), but they must never
// show up again in the live schedule, Medicines tab, or overdue counts.
// Any route that lists/counts MedicationLog entries should scope to this set.
async function getActiveResidentIds() {
    return Resident.find({ status: 'active' }).distinct('_id');
}

async function autoMarkOverdue(logs) {
    const now = new Date();
    const missedCutoff = new Date(now.getTime() - MISSED_GRACE_MINUTES * 60 * 1000);

    // scheduled/pending doses whose time has passed -> overdue (shown as "Delayed")
    const toOverdue = logs.filter(l =>
        (l.status === 'scheduled' || l.status === 'pending') &&
        l.scheduledTime && new Date(l.scheduledTime) < now
    );
    if (toOverdue.length) {
        const ids = toOverdue.map(l => l._id);
        await MedicationLog.updateMany({ _id: { $in: ids } }, { status: 'overdue' });
        toOverdue.forEach(l => { l.status = 'overdue'; });
    }

    // doses that have been overdue for longer than the grace period -> missed
    const toMissed = logs.filter(l =>
        l.status === 'overdue' &&
        l.scheduledTime && new Date(l.scheduledTime) < missedCutoff
    );
    if (toMissed.length) {
        const ids = toMissed.map(l => l._id);
        await MedicationLog.updateMany({ _id: { $in: ids } }, { status: 'missed' });
        toMissed.forEach(l => { l.status = 'missed'; });
    }

    return logs;
}

// ─────────────────────────────────────────────────────────────
// GET CAREGIVERS (for dropdown - real-time)
// ─────────────────────────────────────────────────────────────
router.get('/caregivers', async (req, res) => {
    try {
        const caregivers = await User.find(
            { 
                role: /^caregiver$/i,
                status: { $nin: ['terminated', 'deactivated', 'Terminated', 'Deactivated'] }
            },
            'firstName lastName role email staffId status'
        ).sort({ firstName: 1 });
        
        res.json({ 
            success: true, 
            data: caregivers.map(c => ({
                _id: c._id,
                name: `${c.firstName} ${c.lastName}`,
                firstName: c.firstName,
                lastName: c.lastName,
                role: c.role,
                email: c.email,
                staffId: c.staffId,
                status: c.status
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET OCCUPIED BEDS (for bed availability check)
// ─────────────────────────────────────────────────────────────
router.get('/residents/occupied-beds', async (req, res) => {
    try {
        const { roomNumber, floor } = req.query;
        const query = { status: 'active', bed: { $ne: '' } };
        if (roomNumber) query.roomNumber = roomNumber;
        if (floor) query.floor = floor;
        const occupied = await Resident.find(query, 'bed roomNumber floor firstName lastName');
        res.json({ success: true, data: occupied.map(r => ({ bed: r.bed, roomNumber: r.roomNumber, floor: r.floor, residentName: `${r.firstName} ${r.lastName}` })) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET RESIDENTS
// ─────────────────────────────────────────────────────────────
router.get('/residents', async (req, res) => {
    try {
        const residents = await Resident.find({ status: 'active' })
            .populate('primaryCaregiverId', 'firstName lastName role')
            .sort({ roomNumber: 1 });
        
        const shaped = residents.map(shapeResident);
        res.json({ success: true, data: shaped, count: shaped.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// CREATE RESIDENT (with caregiver assignment) - FIXED VERSION
// ─────────────────────────────────────────────────────────────
router.post('/residents', async (req, res) => {
    try {
        const { 
            firstName, lastName, middleName, nickname, age, gender, 
            roomNumber, floor, bed, conditions, 
            primaryCaregiverId,  // ← ADD THIS - the ObjectId from frontend
            primaryCaregiver,    // ← Keep for backward compatibility
            primaryCaregiverName, // ← ADD THIS - display name
            alertLevel, admissionDate 
        } = req.body;
        
        if (!firstName || !age || !gender || !roomNumber) {
            return res.status(400).json({
                success: false,
                message: 'First name, age, gender, and room number are required.'
            });
        }

        // Bed availability check
        if (bed) {
            const bedOccupied = await Resident.findOne({
                status: 'active',
                roomNumber,
                floor: floor || '',
                bed,
            });
            if (bedOccupied) {
                return res.status(400).json({
                    success: false,
                    message: `${bed} in Room ${roomNumber}${floor ? ' (' + floor + ')' : ''} is already occupied by ${bedOccupied.firstName} ${bedOccupied.lastName}.`,
                });
            }
        }

        const residentId = 'RES' + Date.now().toString().slice(-6);
        
        let finalPrimaryCaregiverName = '';
        let finalPrimaryCaregiverId = null;
        
        // PRIORITY 1: Use primaryCaregiverId if provided (this is the preferred method)
        if (primaryCaregiverId) {
            const caregiver = await findAssignableCaregiver(primaryCaregiverId);
            if (caregiver) {
                finalPrimaryCaregiverName = getCaregiverName(caregiver);
                finalPrimaryCaregiverId = caregiver._id;
            }
        }
        // PRIORITY 2: Fall back to primaryCaregiver as ID string
        else if (primaryCaregiver && primaryCaregiver !== '') {
            const caregiver = await findAssignableCaregiver(primaryCaregiver);
            if (caregiver) {
                finalPrimaryCaregiverName = getCaregiverName(caregiver);
                finalPrimaryCaregiverId = caregiver._id;
            }
        }
        // PRIORITY 3: Use the provided display name
        else if (primaryCaregiverName) {
            finalPrimaryCaregiverName = primaryCaregiverName;
        }
        
        if ((primaryCaregiverId || primaryCaregiver) && !finalPrimaryCaregiverId) {
            return res.status(400).json({ success: false, message: 'Selected caregiver was not found.' });
        }

        // Process conditions - handle both string arrays and object arrays
        let processedConditions = [];
        if (conditions && Array.isArray(conditions)) {
            processedConditions = conditions.map(c => {
                if (typeof c === 'string') {
                    return { name: c, severity: 'mild' };
                }
                return c;
            });
        } else if (conditions && typeof conditions === 'string') {
            // If conditions is a comma-separated string
            processedConditions = conditions.split(',').map(c => ({ name: c.trim(), severity: 'mild' }));
        }
        
        const resident = new Resident({
            residentId, 
            firstName, 
            lastName: lastName || '', 
            middleName: middleName || '', 
            nickname: nickname || '',
            age, 
            gender,
            roomNumber, 
            floor: floor || '', 
            bed: bed || '',
            alertLevel: alertLevel || 'stable',
            admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
            medicalConditions: processedConditions,
            primaryCaregiver: finalPrimaryCaregiverName,
            primaryCaregiverId: finalPrimaryCaregiverId,
            primaryCaregiverName: finalPrimaryCaregiverName,
            assignedNurse: finalPrimaryCaregiverName || (primaryCaregiver ? 'Assigned' : `${req.user.firstName} ${req.user.lastName}`),
            assignedCaregiver: finalPrimaryCaregiverName,
            assignedStaff: {
                primaryCaregiver: finalPrimaryCaregiverName,
                primaryCaregiverName: finalPrimaryCaregiverName,
                primaryCaregiverId: finalPrimaryCaregiverId,
                assignedCaregiver: finalPrimaryCaregiverName,
                assignedNurse: finalPrimaryCaregiverName,
            },
        });
        await resident.save();

        // Fetch the full resident with populated caregiver info for response
        const savedResident = await Resident.findById(resident._id)
            .populate('primaryCaregiverId', 'firstName lastName role');
        
        const shaped = shapeResident(savedResident);

        const io = req.app.get('io');
        if (io) io.emit('residentsUpdated', { residentId: savedResident._id, reason: 'create' });

        res.status(201).json({ success: true, data: shaped });
    } catch (err) {
        console.error('Create resident error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'A resident with this ID already exists. Please try again.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});
// ─────────────────────────────────────────────────────────────
// UPDATE RESIDENT
// ─────────────────────────────────────────────────────────────
router.put('/residents/:id', async (req, res) => {
    try {
        // primaryCaregiver arrives from the client as a display NAME, not an
        // ID — it must never be used to look up a caregiver. primaryCaregiverId
        // is the actual reference. Both are pulled out of `rest` so neither
        // gets written to the update as-is (an empty string '' would fail
        // ObjectId casting and 500 the whole request).
        const { conditions, primaryCaregiver, primaryCaregiverId, primaryCaregiverName, ...rest } = req.body;
        const update = { ...rest };

        // Conditions may arrive either as plain strings or as {name} objects
        // (the Add/Edit Resident form already sends {name} objects) —
        // normalize instead of re-wrapping an object inside another object,
        // which fails Mongoose's String cast for medicalConditions.name.
        if (conditions) {
            update.medicalConditions = conditions.map(c => ({
                name: typeof c === 'string' ? c : (c?.name || ''),
                severity: (typeof c === 'object' && c?.severity) || 'mild',
            })).filter(c => c.name);
        }

        // Resolve the caregiver by ID first (preferred, matches Add Resident),
        // falling back to the legacy name/staffId/email lookup only if no ID
        // was sent. If the field was explicitly cleared, unassign cleanly
        // instead of trying to cast '' to an ObjectId.
        const caregiverInput = primaryCaregiverId || primaryCaregiver;
        if (caregiverInput) {
            const caregiver = await findAssignableCaregiver(caregiverInput);
            if (!caregiver) return res.status(400).json({ success: false, message: 'Selected caregiver was not found.' });
            const caregiverName = getCaregiverName(caregiver);
            update.primaryCaregiver = caregiverName;
            update.primaryCaregiverId = caregiver._id;
            update.primaryCaregiverName = caregiverName;
            update.assignedCaregiver = caregiverName;
            update.assignedNurse = caregiverName;
            update.assignedStaff = {
                primaryCaregiver: caregiverName,
                primaryCaregiverName: caregiverName,
                primaryCaregiverId: caregiver._id,
                assignedCaregiver: caregiverName,
                assignedNurse: caregiverName,
            };
        } else if (primaryCaregiverId === '' || primaryCaregiver === '') {
            // Field was explicitly cleared in the form — unassign.
            update.primaryCaregiver = '';
            update.primaryCaregiverId = null;
            update.primaryCaregiverName = '';
            update.assignedCaregiver = '';
            update.assignedNurse = '';
            update.assignedStaff = {
                primaryCaregiver: '', primaryCaregiverName: '', primaryCaregiverId: null,
                assignedCaregiver: '', assignedNurse: '',
            };
        }

        const resident = await Resident.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
            .populate('primaryCaregiverId', 'firstName lastName role');
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found.' });

        const io = req.app.get('io');
        if (io) io.emit('residentsUpdated', { residentId: resident._id, reason: 'update' });

        res.json({ success: true, data: shapeResident(resident) });
    } catch (err) {
        console.error('Update resident error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// DISCHARGE / REMOVE RESIDENT
// (soft-remove only — never hard-deletes a resident record, so medication
// history and care notes stay intact for audit/compliance purposes)
// ─────────────────────────────────────────────────────────────
const DISCHARGE_REASONS = [
    'deceased',
    'legal_guardianship',
    'adopted',
    'reunited_with_family',
    'transferred_hospital',
    'other'
];

// Maps a discharge reason to the resident's overall status.
function statusForDischargeReason(reason) {
    if (reason === 'deceased') return 'deceased';
    if (reason === 'transferred_hospital') return 'transferred';
    return 'discharged'; // legal_guardianship, adopted, reunited_with_family, other
}

router.put('/residents/:id/discharge', async (req, res) => {
    try {
        const { reason, causeOfDeath, destination, notes } = req.body;

        if (!DISCHARGE_REASONS.includes(reason)) {
            return res.status(400).json({
                success: false,
                message: `Invalid reason. Allowed: ${DISCHARGE_REASONS.join(', ')}`
            });
        }
        if (reason === 'deceased' && !causeOfDeath?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Cause of death is required when marking a resident as deceased.'
            });
        }

        const resident = await Resident.findById(req.params.id);
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found.' });
        if (resident.status !== 'active') {
            return res.status(400).json({ success: false, message: 'This resident has already been discharged.' });
        }

        resident.status = statusForDischargeReason(reason);
        resident.discharge = {
            reason,
            date: new Date(),
            causeOfDeath: reason === 'deceased' ? causeOfDeath.trim() : '',
            destination: destination?.trim() || '',
            notes: notes?.trim() || '',
            recordedBy: req.user._id,
        };
        // Free up the bed for a new admission.
        resident.room = '';
        resident.bed = '';

        await resident.save();

        const io = req.app.get('io');
        if (io) io.emit('residentsUpdated', { residentId: resident._id, reason: 'discharge' });

        res.json({
            success: true,
            data: shapeResident(resident),
            message: `${resident.firstName} ${resident.lastName}`.trim() + ` has been marked as ${resident.status}.`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// LIST DISCHARGED / DECEASED / TRANSFERRED RESIDENTS
// (records view — not shown in the active residents list)
// ─────────────────────────────────────────────────────────────
router.get('/residents/discharged', async (req, res) => {
    try {
        const residents = await Resident.find({ status: { $ne: 'active' } })
            .sort({ 'discharge.date': -1 });
        res.json({ success: true, data: residents.map(shapeResident) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// ASSIGN CAREGIVER
// ─────────────────────────────────────────────────────────────
async function assignCaregiverToResident(req, res) {
    try {
        if (!requireHeadCaregiver(req, res)) return;

        const { caregiverId } = req.body;
        if (!caregiverId) {
            return res.status(400).json({
                success: false,
                message: 'Caregiver is required.'
            });
        }

        const [resident, caregiver] = await Promise.all([
            Resident.findById(req.params.id),
            findAssignableCaregiver(caregiverId)
        ]);

        if (!resident) {
            return res.status(404).json({ success: false, message: 'Resident not found.' });
        }
        if (!caregiver) {
            return res.status(404).json({ success: false, message: 'Caregiver not found.' });
        }

        const caregiverName = getCaregiverName(caregiver);
        const updated = await Resident.findByIdAndUpdate(
            resident._id,
            {
                primaryCaregiver: caregiverName,
                primaryCaregiverName: caregiverName,
                primaryCaregiverId: caregiver._id,
                assignedCaregiver: caregiverName,
                assignedNurse: caregiverName,
                assignedStaff: {
                    primaryCaregiver: caregiverName,
                    primaryCaregiverName: caregiverName,
                    primaryCaregiverId: caregiver._id,
                    assignedCaregiver: caregiverName,
                    assignedNurse: caregiverName,
                },
            },
            { new: true, runValidators: true }
        ).populate('primaryCaregiverId', 'firstName lastName role');

        const io = req.app.get('io');
        if (io) io.emit('residentsUpdated', { residentId: updated._id, reason: 'assign-caregiver' });

        res.json({
            success: true,
            data: shapeResident(updated),
            message: `${caregiverName} assigned to ${updated.firstName} ${updated.lastName}`.trim()
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

router.patch('/residents/:id/assign-caregiver', assignCaregiverToResident);
router.put('/residents/:id/assign-caregiver', assignCaregiverToResident);

// ─────────────────────────────────────────────────────────────
// GET MEDICATIONS
// ─────────────────────────────────────────────────────────────
router.get('/medications', async (req, res) => {
    try {
        const meds = await Medication.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, data: meds });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET SCHEDULE
// ─────────────────────────────────────────────────────────────
router.get('/schedule', async (req, res) => {
    try {
        const { date, residentId } = req.query;
        const target = startOfManilaDay(date ? new Date(date) : new Date());
        const nextDay = new Date(target);
        nextDay.setDate(nextDay.getDate() + 1);

        // Look back 7 days to catch any overdue/unresolved meds from prior days
        const sevenDaysAgo = new Date(target);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const baseQuery = ['admin', 'head_caregiver'].includes(req.user.role)
            ? {}
            : { caregiverId: req.user._id };
        // Exclude discharged/deceased/transferred residents' logs from the live schedule.
        baseQuery.residentId = residentId
            ? residentId
            : { $in: await getActiveResidentIds() };

        // Today's full schedule + past unresolved (overdue/scheduled/pending)
        const [todayLogs, pastLogs] = await Promise.all([
            MedicationLog.find({ ...baseQuery, scheduledTime: { $gte: target, $lt: nextDay } })
                .populate('residentId', 'firstName lastName roomNumber floor bed nickname')
                .populate('medicationId', 'name dosage form purpose')
                .sort({ scheduledTime: 1 }),
            MedicationLog.find({
                ...baseQuery,
                scheduledTime: { $gte: sevenDaysAgo, $lt: target },
                status: { $in: ['scheduled', 'pending', 'overdue'] },
            })
                .populate('residentId', 'firstName lastName roomNumber floor bed nickname')
                .populate('medicationId', 'name dosage form purpose')
                .sort({ scheduledTime: 1 }),
        ]);

        const allLogs = [...pastLogs, ...todayLogs];
        await autoMarkOverdue(allLogs);
        res.json({ success: true, data: allLogs.map(shapeLog), count: allLogs.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET ALL SCHEDULE
// ─────────────────────────────────────────────────────────────
router.get('/schedule/all', async (req, res) => {
    try {
        const { date } = req.query;
        const target = startOfManilaDay(date ? new Date(date) : new Date());
        const nextDay = new Date(target.getTime() + 24 * 60 * 60 * 1000);

        let logs = await MedicationLog.find({
            scheduledTime: { $gte: target, $lt: nextDay },
            residentId: { $in: await getActiveResidentIds() },
        })
            .populate('residentId', 'firstName lastName roomNumber floor bed nickname')
            .populate('medicationId', 'name dosage form purpose')
            .sort({ scheduledTime: 1 });

        logs = await autoMarkOverdue(logs);
        res.json({ success: true, data: logs.map(shapeLog), count: logs.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// CREATE SCHEDULE
// ─────────────────────────────────────────────────────────────
router.post('/schedule', async (req, res) => {
    try {
        const {
            residentId, medicationId, scheduledTime,
            dosage, frequency, nextDose, notes
        } = req.body;

        if (!residentId || !medicationId || !scheduledTime) {
            return res.status(400).json({ 
                success: false, 
                message: 'Resident ID, medication ID, and scheduled time are required.' 
            });
        }

        const [resident, medication] = await Promise.all([
            Resident.findById(residentId),
            Medication.findById(medicationId),
        ]);
        
        if (!resident) return res.status(404).json({ success: false, message: 'Resident not found.' });
        if (!medication) return res.status(404).json({ success: false, message: 'Medication not found.' });

        const finalDosage = dosage || (medication.dosage ? `${medication.dosage.value}${medication.dosage.unit}` : '');
        if (!finalDosage || !String(finalDosage).trim()) {
            return res.status(400).json({ success: false, message: 'Dosage is required.' });
        }

        const logId = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const log = new MedicationLog({
            logId,
            residentId: resident._id,
            medicationId: medication._id,
            caregiverId: resident.primaryCaregiverId || resident.assignedStaff?.primaryCaregiverId || req.user._id,
            residentName: `${resident.firstName} ${resident.lastName}`.trim(),
            medicationName: medication.name,
            room: resident.roomNumber || '',
            floor: resident.floor || '',
            bed: resident.bed || '',
            condition: medication.purpose || '',
            dosage: finalDosage,
            frequency: frequency || '',
            nextDose: nextDose || '',
            scheduledTime: parseManilaDateTime(scheduledTime),
            notes: notes || '',
            status: 'scheduled',
        });
        await log.save();

        res.status(201).json({ success: true, data: shapeLog(log) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET RESIDENT HISTORY
// ─────────────────────────────────────────────────────────────
router.get('/residents/:id/history', async (req, res) => {
    try {
        const logs = await MedicationLog.find({ residentId: req.params.id })
            .sort({ scheduledTime: -1 })
            .limit(50);
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET MEDICATION HISTORY (alias)
// ─────────────────────────────────────────────────────────────
router.get('/residents/:id/medication-history', async (req, res) => {
    try {
        const logs = await MedicationLog.find({ residentId: req.params.id })
            .sort({ scheduledTime: -1 })
            .limit(100);
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// UPDATE SCHEDULE STATUS
// ─────────────────────────────────────────────────────────────
router.put('/schedule/:id/status', async (req, res) => {
    try {
        const { status, notes, verificationMethod } = req.body;
        const allowed = ['scheduled', 'administered', 'overdue', 'missed', 'skipped', 'completed', 'pending'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid status. Allowed: ${allowed.join(', ')}` 
            });
        }

        const log = await MedicationLog.findById(req.params.id);
        if (!log) return res.status(404).json({ success: false, message: 'Log not found.' });

        log.status = status;
        if (status === 'administered' || status === 'completed') {
            log.administeredTime = new Date();
            await Inventory.findOneAndUpdate(
                { name: { $regex: new RegExp(log.medicationName, 'i') } },
                { $inc: { quantity: -1 } }
            );
            if (log.residentId) {
                const stillOverdue = await MedicationLog.findOne({
                    residentId: log.residentId,
                    status: 'overdue',
                    _id: { $ne: log._id }
                });
                if (!stillOverdue) {
                    await Resident.findByIdAndUpdate(log.residentId, {
                        medicationOverdue: false,
                        overdueMed: '',
                        overdueAt: null,
                    });
                }
            }
        }
        if (notes !== undefined) log.notes = notes;
        if (verificationMethod !== undefined) log.verificationMethod = verificationMethod;
        await log.save();

        res.json({ success: true, data: shapeLog(log), message: `Medication marked as ${status}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// UPDATE SCHEDULE
// ─────────────────────────────────────────────────────────────
router.put('/schedule/:id', async (req, res) => {
    try {
        const { scheduledTime, dosage, notes, nextDose, frequency } = req.body;
        if (dosage !== undefined && !String(dosage).trim()) {
            return res.status(400).json({ success: false, message: 'Dosage is required.' });
        }
        const update = {};
        if (scheduledTime !== undefined) update.scheduledTime = parseManilaDateTime(scheduledTime);
        if (dosage !== undefined) update.dosage = dosage;
        if (notes !== undefined) update.notes = notes;
        if (nextDose !== undefined) update.nextDose = nextDose;
        if (frequency !== undefined) update.frequency = frequency;

        const log = await MedicationLog.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
            .populate('residentId', 'firstName lastName roomNumber floor bed nickname')
            .populate('medicationId', 'name dosage form purpose');

        if (!log) return res.status(404).json({ success: false, message: 'Log not found.' });
        res.json({ success: true, data: shapeLog(log) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// DELETE SCHEDULE / MEDICATION LOG ENTRY
// ─────────────────────────────────────────────────────────────
router.delete('/schedule/:id', async (req, res) => {
    try {
        const log = await MedicationLog.findById(req.params.id);
        if (!log) return res.status(404).json({ success: false, message: 'Medication log not found.' });

        await MedicationLog.deleteOne({ _id: req.params.id });

        const io = req.app.get('io');
        if (io) io.emit('residentsUpdated', { residentId: log.residentId, reason: 'medication-deleted' });

        res.json({ success: true, message: 'Medication removed.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET INVENTORY
// ─────────────────────────────────────────────────────────────
router.get('/inventory', async (req, res) => {
    try {
        const items = await Inventory.find({
            category: { $in: ['medication', 'medical_supplies'] }
        }).sort({ name: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// REQUEST STOCK
// ─────────────────────────────────────────────────────────────
router.post('/inventory/request', async (req, res) => {
    try {
        const { itemId, itemName, quantity, unit, reason } = req.body;
        if (!itemName || !quantity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Item name and quantity are required.' 
            });
        }

        const request = new StockRequest({
            itemId: itemId || '',
            itemName: itemName.trim(),
            quantity: +quantity,
            unit: unit || 'pcs',
            reason: reason || '',
            requestedBy: req.user._id,
        });
        await request.save();
        await request.populate('requestedBy', 'firstName lastName role');

        const io = req.app.get('io');
        if (io) io.emit('stock_request', request);

        res.json({
            success: true,
            message: `Stock request for ${quantity} ${unit || 'pcs'} of "${itemName}" submitted.`,
            data: request
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// SAVE VOICE NOTE
// ─────────────────────────────────────────────────────────────
router.post('/voice-note', async (req, res) => {
    try {
        const { note, logId } = req.body;
        if (!note) return res.status(400).json({ success: false, message: 'Note text is required.' });
        if (logId) await MedicationLog.findByIdAndUpdate(logId, { notes: note });
        res.json({ 
            success: true, 
            message: 'Voice note saved.', 
            data: { note, savedAt: new Date(), savedBy: req.user._id } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET STATISTICS
// ─────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const today = startOfManilaDay();
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        const baseQuery = ['admin', 'head_caregiver'].includes(req.user.role)
            ? {}
            : { caregiverId: req.user._id };

        const activeResidentIds = await getActiveResidentIds();
        const [totalResidents, todayLogs, invItems] = await Promise.all([
            Resident.countDocuments({ status: 'active' }),
            MedicationLog.find({ ...baseQuery, residentId: { $in: activeResidentIds }, scheduledTime: { $gte: today, $lt: tomorrow } }),
            Inventory.find({ category: { $in: ['medication', 'medical_supplies'] } }, { quantity: 1, minThreshold: 1 }),
        ]);

        // Flip any doses that are now past due (or past due long enough to
        // count as missed) BEFORE tallying the cards below — otherwise a
        // dose that went overdue after it was last touched by another route
        // just sits as "scheduled"/"pending" forever.
        await autoMarkOverdue(todayLogs);

        const total = todayLogs.length;
        const onTime = todayLogs.filter(l => l.status === 'administered' || l.status === 'completed').length;
        // "overdue" doses are what the dashboard shows as "Delayed" (there is
        // no separate Overdue card in the UI).
        const delayed = todayLogs.filter(l => l.status === 'overdue').length;
        const missed = todayLogs.filter(l => l.status === 'missed').length;
        const pending = todayLogs.filter(l => l.status === 'scheduled' || l.status === 'pending').length;
        const overdue = delayed; // kept for backward compatibility with any caller still reading `overdue`
        const complianceRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
        const lowMedStock = invItems.filter(i => i.quantity <= (i.minThreshold ?? 10)).length;

        res.json({ 
            success: true, 
            data: { 
                totalResidents, 
                total, 
                onTime, 
                delayed, 
                missed, 
                pending, 
                overdue, 
                complianceRate, 
                lowMedStock 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
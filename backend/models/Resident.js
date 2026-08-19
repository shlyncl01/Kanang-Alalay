const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema({
    residentId: {
        type:     String,
        required: true,
        unique:   true,
        uppercase: true
    },
    firstName:  { type: String, required: true, trim: true },
    lastName:   { type: String, default: '', trim: true },
    middleName: { type: String, default: '', trim: true },
    nickname:   { type: String, default: '', trim: true },
    age:        { type: Number, required: true },
    gender:     { type: String, enum: ['female', 'other'], required: true },

    // ── Location ──────────────────────────────────────────────────────────────
    roomNumber: { type: String, required: true },
    room:       { type: String, default: '' },
    floor:      { type: String, default: '' },
    bed:        { type: String, default: '' },
    conditions: [String],
    allergies:  { type: String, default: '' },
    medications: [
        {
            name: { type: String, required: true },
            dosage: { type: String, required: true, validate: { validator: v => !!v && v.trim().length > 0, message: 'Dosage is required.' } },
            frequency: String,
            scheduleTime: String,
            status: { type: String, default: 'active' },
            lastAdministered: Date
        }
    ],
    careNotes: [
        {
            note: { type: String, required: true },
            nurseName: { type: String, default: 'Nurse' },
            createdAt: { type: Date, default: Date.now }
        }
    ],

    // ── Medical ───────────────────────────────────────────────────────────────
    medicalConditions: [{
        name:     String,
        severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' }
    }],

    // ── Alert / Status ────────────────────────────────────────────────────────
    alertLevel: {
        type:    String,
        enum:    ['stable', 'alert', 'critical'],
        default: 'stable'
    },

    // ── Medication overdue tracking ───────────────────────────────────────────
    medicationOverdue: { type: Boolean, default: false },
    overdueMed:        { type: String,  default: '' },
    overdueAt:         { type: Date,    default: null },
    nextMed:           { type: String,  default: '' },

    // ── Assignment ────────────────────────────────────────────────────────────
    assignedNurse:     { type: String, default: '' },
    assignedCaregiver: { type: String, default: '' },
    primaryCaregiver: { type: String, default: '' },
    primaryCaregiverName: { type: String, default: '' },
    primaryCaregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedStaff: {
        primaryCaregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        primaryCaregiverName: { type: String, default: '' },
        primaryCaregiver: { type: String, default: '' },
        assignedCaregiver: { type: String, default: '' },
        assignedNurse: { type: String, default: '' }
    },

    // ── Admission ─────────────────────────────────────────────────────────────
    admissionDate: { type: Date, default: Date.now },
    status: {
        type:    String,
        enum:    ['active', 'discharged', 'transferred', 'deceased'],
        default: 'active'
    },

    // ── Discharge / removal record ────────────────────────────────────────────
    // Populated when a resident leaves the facility for any reason. Never
    // hard-deleted — kept for records/audit even after leaving.
    discharge: {
        reason: {
            type: String,
            enum: [
                'deceased',
                'legal_guardianship',
                'adopted',
                'reunited_with_family',
                'transferred_hospital',
                'other'
            ],
            default: null
        },
        date:         { type: Date, default: null },
        causeOfDeath: { type: String, default: '' }, // required in practice when reason === 'deceased'
        destination:  { type: String, default: '' }, // hospital name / guardian / receiving family member
        notes:        { type: String, default: '' },
        recordedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },

}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.name = ret.name || `${ret.firstName || ''} ${ret.lastName || ''}`.trim();
            ret.room = ret.room || ret.roomNumber;
            ret.conditions = (ret.conditions && ret.conditions.length > 0)
                ? ret.conditions
                : (ret.medicalConditions || []).map((condition) => condition.name).filter(Boolean);
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.name = ret.name || `${ret.firstName || ''} ${ret.lastName || ''}`.trim();
            ret.room = ret.room || ret.roomNumber;
            ret.conditions = (ret.conditions && ret.conditions.length > 0)
                ? ret.conditions
                : (ret.medicalConditions || []).map((condition) => condition.name).filter(Boolean);
            return ret;
        }
    }
});

residentSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`.trim();
});

module.exports = mongoose.model('Resident', residentSchema);
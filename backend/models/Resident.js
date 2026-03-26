const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema({
    residentId: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        required: true
    },
    roomNumber: {
        type: String,
        required: true
    },
    medicalConditions: [{
        name: String,
        severity: String
    }],
    admissionDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'discharged', 'transferred', 'deceased'],
        default: 'active'
    },
    assignedNurse: String,
    assignedCaregiver: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Resident', residentSchema);
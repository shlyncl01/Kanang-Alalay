const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    middleName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true
    },
    residentName: String,
    visitDate: {
        type: Date,
        required: true
    },
    visitTime: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['tour', 'volunteer', 'donation', 'meeting', 'family_visit', 'inspection'],
        required: true
    },
    numberOfVisitors: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'cancelled', 'completed'], 
        default: 'pending' 
    },
    
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
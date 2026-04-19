const mongoose = require('mongoose');

const vitalsLogSchema = new mongoose.Schema({
    residentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', required: true },
    loggedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    bloodPressure:  { type: String, default: '' },   // e.g. "120/80"
    heartRate:      { type: Number, default: null },  // bpm
    temperature:    { type: Number, default: null },  // °C
    oxygenSat:      { type: Number, default: null },  // %
    weight:         { type: Number, default: null },  // kg
    notes:          { type: String, default: '' },
}, { timestamps: true });

vitalsLogSchema.index({ residentId: 1, createdAt: -1 });

module.exports = mongoose.model('VitalsLog', vitalsLogSchema);
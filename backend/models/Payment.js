const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    donationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donation',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'PHP'
    },
    paymentMethod: {
        type: String,
        enum: ['gcash', 'maya', 'credit_card', 'bank_transfer', 'qrph', 'cash'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    paymentIntentId: String,
    clientSecret: String,
    checkoutUrl: String,
    transactionId: String,
    metadata: {
        type: Map,
        of: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    donationId: {
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
    donorName: {
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

    // Amount is ALWAYS required
    amount: {
        type: Number,
        min: 100,
        required: true
    },

    donationType: {
        type: String,
        lowercase: true,
        trim: true,
        enum: ['online', 'cash'],
        required: true
    },

    paymentMethod: {
        type: String,
        lowercase: true,
        trim: true,
        enum: ['gcash', 'maya', 'paypal', 'credit_card', 'debit_card', 'qrph'],
        required: function () {
            return this.donationType === 'online';
        }
    },

    paymentStatus: {
        type: String,
        enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },

    // For cash appointment scheduling
    appointmentDate: Date,
    appointmentTime: String,

    transactionId: String,
    paymentIntentId: String,
    checkoutUrl: String,
    receiptNumber: String,

    // Proof of payment — stores the uploaded filename only.
    // The full URL is constructed by the frontend as:
    //   <BACKEND_BASE>/uploads/<proofOfPayment>
    proofOfPayment: {
        type: String,
        default: null
    },

    designation: {
        type: String,
        enum: ['general', 'medical', 'food', 'facility', 'staff', 'other'],
        default: 'general'
    },
    notes: String,
    anonymous: {
        type: Boolean,
        default: false
    },

    confirmationCode: String,
    verified: {
        type: Boolean,
        default: false
    },
    verificationDate: Date
}, {
    timestamps: true
});

// Generate donation ID before saving
donationSchema.pre('save', function (next) {
    if (!this.donationId) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.donationId = `DON-${timestamp}-${random}`;
    }
    next();
});

module.exports = mongoose.model('Donation', donationSchema);
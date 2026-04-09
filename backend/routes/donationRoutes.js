const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const { sendEmail, generateDonationTemplate } = require('../models/mailer');

// POST /api/donations - Create a new donation
router.post('/', async (req, res) => {
    try {
        // 1. Added firstName, middleName, and lastName here
        const { firstName, middleName, lastName, donorName, email, donationType, phone, amount, appointmentDate, appointmentTime } = req.body;
        const normalizedDonationType = (donationType || '').toString().trim().toLowerCase();
        const normalizedPaymentMethod = req.body.paymentMethod
            ? req.body.paymentMethod.toString().trim().toLowerCase()
            : null;

        // 2. Added firstName and lastName to the strict validation check
        if (!firstName || !lastName || !donorName || !email || !normalizedDonationType || !phone || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const amountNum = Number(amount);
        if (isNaN(amountNum) || amountNum < 100) {
            return res.status(400).json({ success: false, message: 'Amount must be at least ₱100' });
        }

        if (normalizedDonationType === 'cash') {
            if (!appointmentDate || !appointmentTime) {
                return res.status(400).json({ success: false, message: 'Appointment date and time are required for in-person donations' });
            }
        }

        // 3. Included the names in the data payload being sent to MongoDB
        const donationData = {
            firstName,
            middleName: middleName || '', // Optional
            lastName,
            donorName,
            email,
            phone,
            amount: amountNum,
            donationType: normalizedDonationType,
            notes: req.body.notes || '',
            anonymous: req.body.anonymous || false,
            paymentMethod: normalizedPaymentMethod,
            appointmentDate: normalizedDonationType === 'cash' ? appointmentDate : undefined,
            appointmentTime: normalizedDonationType === 'cash' ? appointmentTime : undefined
        };        
        
        const donation = new Donation(donationData);
        await donation.save(); // It will no longer crash here!

        const io = req.app.get('io');
        if (io) io.emit('new_donation', donation);

        // Send Automated Email
        try {
            await sendEmail(donation.email, 'Thank You For Your Donation - Kanang Alalay', generateDonationTemplate(donation));
        } catch (emailErr) {
            console.warn('Donation email failed (non-blocking):', emailErr?.message || emailErr);
        }

        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app';
        const checkoutUrl = normalizedDonationType === 'online'
            ? `${frontendBaseUrl}/donation/success/${donation._id}`
            : null;

        res.status(201).json({ 
            success: true, 
            message: 'Donation submitted successfully', 
            donationId: donation.donationId, 
            checkoutUrl: checkoutUrl, 
            data: donation 
        });

    } catch (error) {
        console.error('Donation error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

// GET /api/donations 
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const donations = await Donation.find().sort({ createdAt: -1 }).limit(limit);
        res.json({ success: true, count: donations.length, data: donations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching donations' });
    }
});

router.put('/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        
        const donation = await Donation.findById(id);
        if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });
        
        donation.paymentStatus = paymentStatus;
        
        if (paymentStatus === 'paid' && !donation.receiptNumber) {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const count = await Donation.countDocuments({ paymentStatus: 'paid' });
            donation.receiptNumber = `RCPT-${year}${month}-${String(count + 1).padStart(3, '0')}`;
        }
        
        await donation.save();
        
        // Emit Real-Time Update
        const io = req.app.get('io');
        if (io) io.emit('update_donation', donation);
        
        res.json({ success: true, data: donation });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server error updating donation' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Donation = require('../models/Donation');
const { sendEmail, generateDonationTemplate } = require('../models/mailer');
const paymentService = require('../services/paymentService');

// ── Multer storage config ─────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `proof_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
        cb(null, name);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, PNG, GIF, WEBP, or PDF files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// POST /api/donations/checkout - Part 9: real PayMongo Hosted Checkout
// Creates a donation record with paymentStatus 'pending', then creates a
// PayMongo Checkout Session for it and returns the real checkout_url for the
// frontend to redirect to. No file upload here — online donations no longer
// require a manually-uploaded proof of payment; PayMongo's own payment
// receipt (sent to the donor's email once they pay) serves that role, and
// the webhook below is the only thing allowed to mark the donation Paid.
router.post('/checkout', async (req, res) => {
    try {
        const {
            firstName, middleName, lastName, donorName,
            email, phone, amount, notes, anonymous
        } = req.body;

        const isAnonymous = anonymous === 'true' || anonymous === true;

        const normalizedFirstName = (firstName || '').toString().trim();
        const normalizedLastName = (lastName || '').toString().trim();
        const normalizedDonorName = (donorName || '').toString().trim();
        const normalizedEmail = (email || '').toString().trim().toLowerCase();
        const normalizedPhone = (phone || '').toString().trim();

        const missingFields = [];
        if (!normalizedPhone) missingFields.push('phone');
        // Email is always required here (even when anonymous) because PayMongo
        // needs somewhere to send the payment receipt — this mirrors the
        // "donor email required for PayMongo receipt delivery" requirement.
        if (!normalizedEmail) missingFields.push('email');
        if (!isAnonymous) {
            if (!normalizedFirstName) missingFields.push('firstName');
            if (!normalizedLastName) missingFields.push('lastName');
            if (!normalizedDonorName) missingFields.push('donorName');
        }
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }

        const amountNum = Number(amount);
        if (!amount || isNaN(amountNum) || amountNum < 100) {
            return res.status(400).json({ success: false, message: 'Amount must be at least ₱100' });
        }

        // Create the donation as pending BEFORE creating the Checkout Session,
        // so we always have a record to reconcile against even if the donor
        // never completes payment.
        const donation = new Donation({
            firstName: isAnonymous ? 'Anonymous' : normalizedFirstName,
            middleName: isAnonymous ? '' : (middleName || '').toString().trim(),
            lastName: isAnonymous ? 'Donor' : normalizedLastName,
            donorName: isAnonymous ? 'Anonymous Donor' : normalizedDonorName,
            email: normalizedEmail, // real email kept even if anonymous, so PayMongo can deliver the receipt
            phone: normalizedPhone,
            amount: amountNum,
            donationType: 'online',
            // Placeholder — the donor actually picks their method (GCash, Maya,
            // card, QRPH) on PayMongo's hosted page. Updated to the real method
            // once the webhook reports which source was used.
            paymentMethod: 'qrph',
            notes: (notes || '').toString().trim(),
            anonymous: isAnonymous,
            paymentStatus: 'pending'
        });
        await donation.save();

        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app';
        const successUrl = `${frontendBaseUrl}/donation?paymongo=success&donation=${donation._id}`;
        const cancelUrl = `${frontendBaseUrl}/donation?paymongo=cancelled&donation=${donation._id}`;

        let session;
        try {
            session = await paymentService.createCheckoutSession({
                amount: Math.round(amountNum * 100), // PHP -> centavos
                donationId: donation._id,
                referenceNumber: donation.donationId,
                donorName: donation.donorName,
                donorEmail: normalizedEmail,
                successUrl,
                cancelUrl
            });
        } catch (gatewayErr) {
            console.error('PayMongo checkout session error:', gatewayErr.response?.data || gatewayErr.message);
            donation.paymentStatus = 'failed';
            await donation.save().catch(() => {});
            return res.status(502).json({
                success: false,
                message: 'Could not start PayMongo checkout. Please try again.'
            });
        }

        donation.paymongoCheckoutSessionId = session.id;
        donation.checkoutUrl = session.attributes?.checkout_url || null;
        await donation.save();

        const io = req.app.get('io');
        if (io) io.emit('new_donation', donation);

        res.status(201).json({
            success: true,
            message: 'Checkout session created',
            donationId: donation.donationId,
            id: donation._id,
            checkoutUrl: donation.checkoutUrl
        });
    } catch (error) {
        console.error('Checkout session error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

// POST /api/donations - Create a new donation
// ✅ FIXED: Now respects anonymous flag for validation and data storage
// NOTE (Part 9): Online/PayMongo donations no longer go through this route —
// see POST /checkout above. This endpoint now only handles Cash donations;
// it's kept generic here in case anything server-side still calls it, but
// deliberately rejects donationType 'online' so a request can't bypass the
// real payment gateway and get marked paid without ever paying.
router.post('/', upload.single('proofOfPayment'), async (req, res) => {
    try {
        console.log('=== Received donation submission ===');
        console.log('req.body:', req.body);
        console.log('req.file:', req.file ? req.file.filename : 'No file');
        
        // Extract fields
        const {
            firstName, middleName, lastName, donorName,
            email, donationType, phone, amount,
            appointmentDate, appointmentTime, notes, anonymous, paymentMethod
        } = req.body;

        // ✅ NEW: Check anonymous flag FIRST
        const isAnonymous = anonymous === 'true' || anonymous === true;
        console.log('Is anonymous:', isAnonymous);

        // Normalize values
        const normalizedFirstName = (firstName || '').toString().trim();
        const normalizedLastName = (lastName || '').toString().trim();
        const normalizedDonorName = (donorName || '').toString().trim();
        const normalizedEmail = (email || '').toString().trim().toLowerCase();
        const normalizedDonationType = (donationType || '').toString().trim().toLowerCase();
        const normalizedPhone = (phone || '').toString().trim();

        // Part 9: online donations must go through the real PayMongo Checkout
        // Session flow (POST /checkout) so they're never marked Paid without
        // actually being paid. Block this route from creating them directly.
        if (normalizedDonationType === 'online') {
            return res.status(400).json({
                success: false,
                message: 'Online donations must be created via POST /api/donations/checkout'
            });
        }

        // ✅ FIXED: Validate required fields based on anonymous flag
        const missingFields = [];
        
        // These are ALWAYS required
        if (!normalizedDonationType) missingFields.push('donationType');
        if (!normalizedPhone) missingFields.push('phone');
        
        // These are only required if NOT anonymous
        if (!isAnonymous) {
            if (!normalizedFirstName) missingFields.push('firstName');
            if (!normalizedLastName) missingFields.push('lastName');
            if (!normalizedEmail) missingFields.push('email');
            if (!normalizedDonorName) missingFields.push('donorName');
        }
        
        if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
            return res.status(400).json({ 
                success: false, 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // ✅ NEW: Validate email format only if provided and not anonymous
        if (!isAnonymous && normalizedEmail) {
            if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid email address' 
                });
            }
        }

        // Handle amount based on donation type
        let amountNum = 0;
        let rawAmount = (amount || '').toString().trim();
        
        if (normalizedDonationType === 'cash') {
            // For cash, amount is optional - default to 0
            if (rawAmount && rawAmount !== '') {
                amountNum = Number(rawAmount);
                if (isNaN(amountNum)) {
                    amountNum = 0;
                }
            } else {
                amountNum = 0;
            }
            
            // Validate appointment for cash donations
            const appointmentDateVal = (appointmentDate || '').toString().trim();
            const appointmentTimeVal = (appointmentTime || '').toString().trim();
            if (!appointmentDateVal || !appointmentTimeVal) {
                return res.status(400).json({
                    success: false,
                    message: 'Appointment date and time are required for in-person donations'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: `Invalid donation type: ${normalizedDonationType}. This endpoint only accepts 'cash'.`
            });
        }

        // ✅ FIXED: Prepare donation data with anonymous handling
        const donationData = {
            // ✅ Use placeholder values for anonymous donations
            firstName: isAnonymous ? 'Anonymous' : normalizedFirstName,
            middleName: isAnonymous ? '' : (middleName || '').toString().trim(),
            lastName: isAnonymous ? 'Donor' : normalizedLastName,
            donorName: isAnonymous ? 'Anonymous Donor' : normalizedDonorName,
            email: isAnonymous ? 'anonymous@kanangalalay.org' : normalizedEmail,
            phone: normalizedPhone,
            amount: amountNum,
            donationType: normalizedDonationType,
            notes: (notes || '').toString().trim(),
            anonymous: isAnonymous,
            paymentMethod: null, // this route only ever creates 'cash' donations now (see guard above)
            appointmentDate: normalizedDonationType === 'cash' ? appointmentDate : undefined,
            appointmentTime: normalizedDonationType === 'cash' ? appointmentTime : undefined,
            proofOfPayment: req.file ? req.file.filename : undefined,
            paymentStatus: 'pending'
        };

        console.log('Saving donation:', donationData);

        const donation = new Donation(donationData);
        await donation.save();

        console.log('Donation saved successfully:', donation._id, 'Donation ID:', donation.donationId);

        // Emit socket event if available
        const io = req.app.get('io');
        if (io) io.emit('new_donation', donation);

        // Send email (non-blocking)
        try {
            // ✅ Use appropriate email based on anonymous flag
            const emailRecipient = isAnonymous ? 'anonymous@kanangalalay.org' : donation.email;
            await sendEmail(
                emailRecipient,
                'Thank You For Your Donation - Kanang Alalay',
                generateDonationTemplate(donation)
            );
            console.log('Confirmation email sent for:', isAnonymous ? 'Anonymous Donor' : donation.email);
        } catch (emailErr) {
            console.warn('Donation email failed (non-blocking):', emailErr?.message || emailErr);
        }

        res.status(201).json({
            success: true,
            message: 'Donation submitted successfully',
            donationId: donation.donationId,
            data: donation
        });

    } catch (error) {
        console.error('Donation error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error' 
        });
    }
});

// GET /api/donations
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const donations = await Donation.find().sort({ createdAt: -1 }).limit(limit);
        res.json({ success: true, count: donations.length, data: donations });
    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ success: false, message: 'Server error fetching donations' });
    }
});

// GET /api/donations/:id
router.get('/:id', async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id);
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }
        res.json({ success: true, data: donation });
    } catch (error) {
        console.error('Error fetching donation:', error);
        res.status(500).json({ success: false, message: 'Server error fetching donation' });
    }
});

// PUT /api/donations/:id/payment
router.put('/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;

        const donation = await Donation.findById(id);
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }

        donation.paymentStatus = paymentStatus;

        if (paymentStatus === 'paid' && !donation.receiptNumber) {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const count = await Donation.countDocuments({ paymentStatus: 'paid' });
            donation.receiptNumber = `RCPT-${year}${month}-${String(count + 1).padStart(3, '0')}`;
        }

        await donation.save();

        const io = req.app.get('io');
        if (io) io.emit('update_donation', donation);

        res.json({ success: true, data: donation });

    } catch (error) {
        console.error('Error updating donation:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error updating donation' 
        });
    }
});

module.exports = router;
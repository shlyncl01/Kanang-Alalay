const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Donation = require('../models/Donation');
const { sendEmail, generateDonationTemplate } = require('../models/mailer');

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

// POST /api/donations - Create a new donation
// ✅ FIXED: Now respects anonymous flag for validation and data storage
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
        
        if (normalizedDonationType === 'online') {
            // For online, amount is required and must be positive
            if (!rawAmount || rawAmount === '') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Amount is required for online donations' 
                });
            }
            amountNum = Number(rawAmount);
            if (isNaN(amountNum) || amountNum <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Amount must be a valid positive number' 
                });
            }
            
            // Payment method required for online
            if (!paymentMethod) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Payment method is required for online donations' 
                });
            }

            // Proof of donation receipt required for online donations — mirrors
            // the frontend's existing requirement (DonationPage.js validate()),
            // enforced server-side so the check can't be bypassed by calling
            // this endpoint directly. Applies regardless of the anonymous flag,
            // same as the frontend check.
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Proof of donation receipt is required for online donations.'
                });
            }
        } else if (normalizedDonationType === 'cash') {
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
                message: `Invalid donation type: ${normalizedDonationType}. Must be 'online' or 'cash'`
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
            paymentMethod: normalizedDonationType === 'online' ? (paymentMethod || 'qrph').toString().trim().toLowerCase() : null,
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

        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app';
        const checkoutUrl = normalizedDonationType === 'online'
            ? `${frontendBaseUrl}/donation/success/${donation._id}`
            : null;

        res.status(201).json({
            success: true,
            message: 'Donation submitted successfully',
            donationId: donation.donationId,
            checkoutUrl,
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
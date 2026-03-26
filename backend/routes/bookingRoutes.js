const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const nodemailer = require('nodemailer');

// Create booking with validation
router.post('/', async (req, res) => {
    try {
        const { visitDate, visitTime, numberOfVisitors } = req.body;
        
        // Validate date not in past
        const selectedDate = new Date(visitDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return res.status(400).json({ message: 'Cannot book in the past' });
        }

        // Validate visiting hours (9AM-5PM)
        const hour = parseInt(visitTime.split(':')[0]);
        if (hour < 9 || hour > 17) {
            return res.status(400).json({ message: 'Visiting hours are 9AM-5PM' });
        }

        // Check slot availability
        const existingBookings = await Booking.countDocuments({
            visitDate: selectedDate,
            visitTime: visitTime,
            status: { $in: ['pending', 'confirmed'] }
        });

        const maxVisitorsPerSlot = 10;
        if (existingBookings >= maxVisitorsPerSlot) {
            return res.status(400).json({ message: 'Time slot is fully booked' });
        }

        // Create booking
        const booking = new Booking({
            bookingId: `BK${Date.now()}`,
            ...req.body
        });

        await booking.save();

        // Send confirmation email
        sendBookingConfirmationEmail(booking);

        res.status(201).json({ 
            message: 'Booking submitted successfully',
            bookingId: booking.bookingId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin approve/reject booking
router.patch('/:id/status', authMiddleware, roleMiddleware('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.status = status;
        booking.confirmedBy = req.user._id;
        booking.confirmationDate = new Date();
        
        await booking.save();

        // Send status update email
        sendBookingStatusEmail(booking);

        res.json({ 
            message: `Booking ${status} successfully`,
            booking 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get bookings with filters
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, date, purpose } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (date) filter.visitDate = new Date(date);
        if (purpose) filter.purpose = purpose;

        const bookings = await Booking.find(filter)
            .sort({ visitDate: 1, visitTime: 1 })
            .populate('confirmedBy', 'firstName lastName');

        res.json(bookings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Email sending functions
const sendBookingConfirmationEmail = async (booking) => {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: 'Booking Confirmation - Kanang Alalay',
        html: `
            <h2>Booking Received!</h2>
            <p>Dear ${booking.name},</p>
            <p>Your visit has been scheduled:</p>
            <ul>
                <li><strong>Date:</strong> ${new Date(booking.visitDate).toDateString()}</li>
                <li><strong>Time:</strong> ${booking.visitTime}</li>
                <li><strong>Purpose:</strong> ${booking.purpose}</li>
                <li><strong>Visitors:</strong> ${booking.numberOfVisitors}</li>
            </ul>
            <p>Status: <strong>Pending Approval</strong></p>
            <p>We will notify you once your booking is approved.</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = router;
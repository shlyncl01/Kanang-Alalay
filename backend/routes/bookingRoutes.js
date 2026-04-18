const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { sendEmail, generateBookingTemplate, generateBookingConfirmationTemplate, generateBookingRejectionTemplate } = require('../models/mailer');

router.post('/', async (req, res) => {
    try {
        const { firstName, middleName, lastName, name, email, phone, visitDate, visitTime, purpose, numberOfVisitors, notes } = req.body;
        
        if (!firstName || !lastName || !name || !email || !phone || !visitDate || !visitTime || !purpose || !numberOfVisitors) {
            return res.status(400).json({ success: false, message: 'Missing required fields. Please fill out all required inputs.' });
        }

        const selectedDate = new Date(visitDate);
        selectedDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return res.status(400).json({ success: false, message: 'Cannot book in the past. Please select today or a future date.' });
        }

        const hour = parseInt(visitTime.split(':')[0]);
        if (hour < 9 || hour > 17) return res.status(400).json({ success: false, message: 'Visiting hours are 9AM - 5PM' });

        const existingBookings = await Booking.countDocuments({
            visitDate: {
                $gte: selectedDate,
                $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
            },
            visitTime: visitTime,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingBookings >= 10) return res.status(400).json({ success: false, message: 'Time slot is fully booked' });

        const bookingData = {
            bookingId: `BK${Date.now()}`,
            firstName,
            middleName: middleName || '',
            lastName,
            name,
            email,
            phone,
            visitDate: selectedDate,
            visitTime,
            purpose,
            numberOfVisitors: Number(numberOfVisitors),
            notes: notes || '',
            status: 'pending'
        };

        const booking = new Booking(bookingData);
        await booking.save();

        const io = req.app.get('io');
        if (io) io.emit('new_booking', booking);

        try {
            await sendEmail(booking.email, 'Booking Request Received - Kanang Alalay', generateBookingTemplate(booking));
        } catch (emailErr) {
            console.warn('Booking email failed (non-blocking):', emailErr?.message || emailErr);
        }

        res.status(201).json({
            success: true,
            message: 'Booking submitted successfully',
            data: { bookingId: booking.bookingId, booking }
        });

    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

// GET all bookings
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const bookings = await Booking.find().sort({ createdAt: -1 }).limit(limit);
        res.json({ success: true, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// UPDATE booking 
router.put('/:id/status', async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const previousStatus = booking.status;
        booking.status = status;
        await booking.save();

        try {
            if (status === 'approved' && previousStatus !== 'approved') {
                await sendEmail(
                    booking.email,
                    'Booking Confirmed - Kanang Alalay',
                    generateBookingConfirmationTemplate(booking)
                );
                console.log(`✅ Approval email sent to ${booking.email}`);
            } 
            else if (status === 'rejected' && previousStatus !== 'rejected') {
                await sendEmail(
                    booking.email,
                    'Booking Update - Kanang Alalay',
                    generateBookingRejectionTemplate(booking, rejectionReason)
                );
                console.log(`📧 Rejection email sent to ${booking.email}`);
            }
        } catch (emailErr) {
            console.error('❌ Failed to send status email:', emailErr.message);
        }

        const io = req.app.get('io');
        if (io) io.emit('update_booking', booking);

        res.status(200).json({ 
            success: true, 
            data: booking,
            message: `Booking ${status} successfully${status === 'rejected' ? ' - Email notification sent' : ''}`
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE booking 
router.delete('/:id', async (req, res) => {
    try {
        const booking = await Booking.findByIdAndDelete(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        
        const io = req.app.get('io');
        if (io) io.emit('delete_booking', booking._id);
        
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
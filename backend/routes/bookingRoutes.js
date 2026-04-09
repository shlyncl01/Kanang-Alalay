const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const Alert = require('../models/Alert');
const { sendEmail, generateBookingTemplate } = require('../models/mailer');

// Create booking with validation, real email, and socket event
router.post('/', async (req, res) => {
    try {
        // 1. Explicitly extract all fields so we know exactly what is going to the database
        const { firstName, middleName, lastName, name, email, phone, visitDate, visitTime, purpose, numberOfVisitors, notes } = req.body;
        
        // 2. Strict frontend-to-backend validation
        if (!firstName || !lastName || !name || !email || !phone || !visitDate || !visitTime || !purpose || !numberOfVisitors) {
            return res.status(400).json({ success: false, message: 'Missing required fields. Please fill out all required inputs.' });
        }

        // 3. Timezone-safe date validation
        const selectedDate = new Date(visitDate);
        selectedDate.setHours(0, 0, 0, 0); // Strip time to ensure accurate day comparison
        
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

        // 4. Construct the exact object Mongoose expects
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
            notes: notes || ''
        };

        const booking = new Booking(bookingData);
        await booking.save();

        // 5. Emit Real-Time Socket Event
        const io = req.app.get('io');
        if (io) io.emit('new_booking', booking);

        // 6. Send Automated Email
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
        // We now send the EXACT error back to the frontend so it shows up in your red Alert box!
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

// Admin update booking status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body; 
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (status === 'approved' || status === 'Approved') {
      await Alert.create({
        type: "Booking", title: "Booking Approved",
        message: `Booking for ${booking.name || 'Applicant'} has been approved.`,
        details: { bookingId: booking._id, date: booking.visitDate }
      });
    }

    // Emit Real-Time Update
    const io = req.app.get('io');
    if (io) io.emit('update_booking', booking);

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const bookings = await Booking.find().sort({ createdAt: -1 }).limit(limit);
        res.json({ success: true, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
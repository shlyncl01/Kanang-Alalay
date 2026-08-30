const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { sendEmail, generateBookingTemplate, generateBookingConfirmationTemplate, generateBookingRejectionTemplate, generateBookingCancelledTemplate } = require('../models/mailer');
const { autoCompletePastBookings } = require('../utils/bookingAutoComplete');

// Validation helper function
const validateBookingInput = (data) => {
    const errors = [];
    
    if (!data.firstName || data.firstName.trim().length < 2) {
        errors.push('First name must be at least 2 characters');
    }
    if (!data.lastName || data.lastName.trim().length < 2) {
        errors.push('Last name must be at least 2 characters');
    }
    if (!data.name || data.name.trim().length < 2) {
        errors.push('Full name must be at least 2 characters');
    }
    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
        errors.push('Valid email address is required');
    }
    if (!data.phone || !/^[\d+\-\s()]{8,20}$/.test(data.phone)) {
        errors.push('Valid phone number is required (8-20 digits)');
    }
    if (!data.visitDate) {
        errors.push('Visit date is required');
    }
    if (!data.visitTime) {
        errors.push('Visit time is required');
    }
    if (!data.purpose || !['tour', 'volunteer', 'donation', 'meeting', 'family_visit', 'inspection'].includes(data.purpose)) {
        errors.push('Valid purpose is required');
    }
    if (!data.numberOfVisitors || data.numberOfVisitors < 1 || data.numberOfVisitors > 10) {
        errors.push('Number of visitors must be between 1 and 10');
    }
    
    return errors;
};

router.post('/', async (req, res) => {
    try {
        const { firstName, middleName, lastName, name, email, phone, visitDate, visitTime, purpose, numberOfVisitors, notes } = req.body;
        
        // Validate input
        const validationErrors = validateBookingInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: validationErrors 
            });
        }

        const selectedDate = new Date(visitDate);
        selectedDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return res.status(400).json({ success: false, message: 'Cannot book in the past. Please select today or a future date.' });
        }

        // Limit booking to 30 days in advance
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 30);
        if (selectedDate > maxFutureDate) {
            return res.status(400).json({ success: false, message: 'Bookings can only be made up to 30 days in advance.' });
        }

        const hour = parseInt(visitTime.split(':')[0]);
        if (hour < 9 || hour > 17) {
            return res.status(400).json({ success: false, message: 'Visiting hours are 9AM - 5PM only.' });
        }

        // Check slot availability (max 10 per time slot)
        const existingBookings = await Booking.countDocuments({
            visitDate: {
                $gte: selectedDate,
                $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
            },
            visitTime: visitTime,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingBookings >= 10) {
            return res.status(400).json({ success: false, message: 'This time slot is fully booked. Please choose another time.' });
        }

        const bookingData = {
            bookingId: `BK${Date.now()}`,
            firstName: firstName.trim(),
            middleName: middleName ? middleName.trim() : '',
            lastName: lastName.trim(),
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
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

        // Send confirmation email (non-blocking)
        try {
            await sendEmail(booking.email, 'Booking Request Received - Kanang Alalay', generateBookingTemplate(booking));
            console.log(`📧 Booking confirmation email sent to ${booking.email}`);
        } catch (emailErr) {
            console.error('❌ Booking email failed:', emailErr?.message || emailErr);
        }

        res.status(201).json({
            success: true,
            message: 'Booking submitted successfully. You will receive a confirmation email shortly.',
            data: { bookingId: booking.bookingId, booking }
        });

    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

// GET all bookings with pagination and filtering
router.get('/', async (req, res) => {
    try {
        // Lazily flip any 'approved' booking whose scheduled visiting window has
        // already passed to 'completed', so the list is accurate even if the
        // periodic server-side check hasn't ticked recently (e.g. cold start).
        await autoCompletePastBookings();

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const status = req.query.status;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let query = {};
        
        if (status && ['pending', 'approved', 'rejected', 'cancelled', 'completed'].includes(status)) {
            query.status = status;
        }
        
        if (startDate || endDate) {
            query.visitDate = {};
            if (startDate) query.visitDate.$gte = new Date(startDate);
            if (endDate) query.visitDate.$lte = new Date(endDate);
        }
        
        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
            
        const total = await Booking.countDocuments(query);
            
        res.json({ 
            success: true, 
            data: bookings,
            pagination: {
                total,
                limit,
                returned: bookings.length
            }
        });
    } catch (error) {
        console.error('GET bookings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET single booking
router.get('/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// UPDATE booking status with email notification
router.put('/:id/status', async (req, res) => {
    try {
        const { status, rejectionReason, facilityAvailability } = req.body;
        
        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            });
        }
        
        // Validate rejection reason if rejecting
        if (status === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 5)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a rejection reason (minimum 5 characters)' 
            });
        }
        
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        
        // Prevent invalid status transitions
        const invalidTransitions = {
            'completed': ['pending', 'rejected'],
            'rejected': ['approved', 'completed'],
            'cancelled': ['approved', 'completed']
        };
        
        if (invalidTransitions[status] && invalidTransitions[status].includes(booking.status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot change status from '${booking.status}' to '${status}'` 
            });
        }
        
        const previousStatus = booking.status;
        booking.status = status;
        
        if (status === 'rejected') {
            booking.rejectionReason = rejectionReason.trim();
        }

        if (status === 'approved' && facilityAvailability) {
            booking.facilityAvailability = facilityAvailability;
        }
        
        await booking.save();
        
        // Send email notification based on status change
        let emailSent = false;
        let emailError = null;
        
        try {
            if (status === 'approved' && previousStatus !== 'approved') {
                await sendEmail(
                    booking.email,
                    '✅ Booking Confirmed - Kanang Alalay',
                    generateBookingConfirmationTemplate(booking, facilityAvailability)
                );
                emailSent = true;
                console.log(`✅ Approval email sent to ${booking.email}`);
            } 
            else if (status === 'rejected' && previousStatus !== 'rejected') {
                await sendEmail(
                    booking.email,
                    '❌ Booking Update - Kanang Alalay',
                    generateBookingRejectionTemplate(booking, rejectionReason)
                );
                emailSent = true;
                console.log(`📧 Rejection email sent to ${booking.email}`);
            }
            else if (status === 'cancelled' && previousStatus !== 'cancelled') {
                await sendEmail(
                    booking.email,
                    '⚠️ Booking Cancelled - Kanang Alalay',
                    generateBookingCancelledTemplate(booking) 
                );
                emailSent = true;
                console.log(`📧 Cancellation email sent to ${booking.email}`);
            }
        } catch (emailErr) {
            emailError = emailErr.message;
            console.error('❌ Failed to send status email:', emailErr.message);
        }
        
        const io = req.app.get('io');
        if (io) io.emit('update_booking', booking);
        
        res.status(200).json({ 
            success: true, 
            data: booking,
            message: `Booking ${status} successfully${emailSent ? ' - Email notification sent' : emailError ? ' - Email failed to send' : ''}`,
            emailSent: emailSent,
            emailError: emailError
        });
        
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE booking 
router.delete('/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        
        // Optional: Send cancellation email before deletion
        try {
            await sendEmail(
                booking.email,
                'Booking Cancelled - Kanang Alalay',
                `
                <div style="background-color: #fcf8f5; padding: 40px 20px;">
                    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px;">
                        <h2 style="color: #dc3545;">Booking Cancelled</h2>
                        <p>Your booking for ${new Date(booking.visitDate).toLocaleDateString()} at ${booking.visitTime} has been cancelled.</p>
                        <p>Please contact us if you have any questions.</p>
                    </div>
                </div>
                `
            );
        } catch (emailErr) {
            console.error('Cancellation email failed:', emailErr.message);
        }
        
        await Booking.findByIdAndDelete(req.params.id);
        
        const io = req.app.get('io');
        if (io) io.emit('delete_booking', booking._id);
        
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Delete booking error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET available time slots for a specific date
router.get('/available-slots/:date', async (req, res) => {
    try {
        const date = new Date(req.params.date);
        date.setHours(0, 0, 0, 0);
        
        const timeSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
        
        const slotAvailability = await Promise.all(timeSlots.map(async (slot) => {
            const bookedCount = await Booking.countDocuments({
                visitDate: {
                    $gte: date,
                    $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
                },
                visitTime: slot,
                status: { $in: ['pending', 'approved'] }
            });
            
            return {
                time: slot,
                available: 10 - bookedCount,
                isAvailable: (10 - bookedCount) > 0
            };
        }));
        
        res.json({ 
            success: true, 
            data: slotAvailability,
            date: date.toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Available slots error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Resident = require('../models/Resident');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Get all residents
router.get('/', authMiddleware, async (req, res) => {
    try {
        const residents = await Resident.find({ status: 'active' })
            .populate('assignedCaregivers', 'firstName lastName role')
            .sort({ roomNumber: 1 });
        res.json(residents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get assigned residents for caregiver
router.get('/assigned', authMiddleware, async (req, res) => {
    try {
        const residents = await Resident.find({
            assignedCaregivers: req.user._id,
            status: 'active'
        })
        .sort({ roomNumber: 1 });
        
        res.json(residents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new resident (admin only)
router.post('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
    try {
        // Generate resident ID
        const residentId = 'RES' + Date.now().toString().slice(-6);
        
        const resident = new Resident({
            residentId,
            ...req.body
        });

        await resident.save();
        res.status(201).json(resident);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update resident
router.put('/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
    try {
        const resident = await Resident.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!resident) {
            return res.status(404).json({ message: 'Resident not found' });
        }
        
        res.json(resident);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get resident statistics
router.get('/statistics', authMiddleware, async (req, res) => {
    try {
        const totalResidents = await Resident.countDocuments({ status: 'active' });
        const averageAge = await Resident.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: null, avgAge: { $avg: '$age' } } }
        ]);
        
        const conditionStats = await Resident.aggregate([
            { $match: { status: 'active' } },
            { $unwind: '$medicalConditions' },
            { $group: { _id: '$medicalConditions.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            totalResidents,
            averageAge: averageAge[0]?.avgAge || 0,
            conditionStats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
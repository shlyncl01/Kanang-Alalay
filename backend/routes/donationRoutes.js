// donationRoutes.js
const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');

// Simple in-memory storage if MongoDB fails
let inMemoryStorage = [];

// POST /api/donations - Create a new donation
router.post('/donations', async (req, res) => {
  try {
    console.log('Request body received:', req.body);
    
    const { donorName, email, donationType } = req.body;

    // Basic validation - these are required for ALL donation types
    if (!donorName || !email || !donationType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: donorName, email, donationType are required'
      });
    }

    // Conditional amount validation
    if (donationType !== 'goods') {
      // For monetary donations, amount is required
      const { amount } = req.body;
      if (!amount || amount < 100) {
        return res.status(400).json({
          success: false,
          message: 'Amount is required and minimum is ₱100 for monetary donations'
        });
      }
    }

    try {
      // Try to save to MongoDB if connected
      const donation = new Donation(req.body);
      await donation.save();

      res.status(201).json({
        success: true,
        donationId: donation.donationId,
        data: donation,
        checkoutUrl: donationType === 'online' ? 'https://payment.example.com/checkout' : null
      });
    } catch (dbError) {
      console.log('MongoDB save failed, using in-memory storage:', dbError.message);
      
      // Fallback to in-memory storage
      const tempDonation = {
        ...req.body,
        donationId: `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date()
      };
      
      inMemoryStorage.push(tempDonation);
      
      res.status(201).json({
        success: true,
        donationId: tempDonation.donationId,
        data: tempDonation,
        checkoutUrl: donationType === 'online' ? 'https://payment.example.com/checkout' : null,
        note: 'Using temporary storage (MongoDB not available)'
      });
    }

  } catch (error) {
    console.error('Donation creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// GET /api/donations - Get all donations
router.get('/donations', async (req, res) => {
  try {
    // Try MongoDB first
    try {
      const donations = await Donation.find().sort({ createdAt: -1 });
      return res.json({ success: true, data: donations, source: 'mongodb' });
    } catch (dbError) {
      // Fallback to in-memory
      return res.json({ success: true, data: inMemoryStorage, source: 'memory' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
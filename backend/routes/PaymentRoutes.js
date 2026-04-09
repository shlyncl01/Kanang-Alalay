const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Donation = require('../models/Donation');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const paymentService = require('../services/paymentService');

// Create payment intent
router.post('/create-intent', async (req, res) => {
    try {
        const { donationId, paymentMethod, amount } = req.body;
        
        const donation = await Donation.findById(donationId);
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        // QRPH and cash are manual — no gateway needed
        if (paymentService.isManualMethod(paymentMethod)) {
            const payment = new Payment({
                paymentId: `PAY${Date.now()}`,
                donationId,
                amount,
                paymentMethod,
                status: paymentMethod === 'cash' ? 'pending' : 'processing'
            });
            await payment.save();

            return res.json({
                paymentId: payment.paymentId,
                status: payment.status
            });
        }

        // Create payment intent with PayMongo for gateway methods
        const paymentIntent = await paymentService.createPaymentIntent({
            amount: amount * 100, // Convert to centavos
            paymentMethod: paymentMethod,
            metadata: {
                donationId: donationId,
                donorName: donation.donorName,
                email: donation.email
            }
        });

        // Save payment record
        const payment = new Payment({
            paymentId: `PAY${Date.now()}`,
            donationId,
            amount,
            paymentMethod,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            checkoutUrl: paymentIntent.checkout_url,
            status: 'pending'
        });

        await payment.save();

        res.json({
            checkoutUrl: payment.checkoutUrl,
            clientSecret: payment.clientSecret,
            paymentId: payment.paymentId
        });

    } catch (error) {
        console.error('Payment intent error:', error);
        res.status(500).json({ message: 'Payment processing failed' });
    }
});

// Check payment status
router.get('/status/:paymentId', async (req, res) => {
    try {
        const payment = await Payment.findOne({ paymentId: req.params.paymentId });
        
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Check status from payment gateway
        const status = await paymentService.checkPaymentStatus(payment.paymentIntentId);
        
        // Update local status if changed
        if (payment.status !== status) {
            payment.status = status;
            payment.completedAt = status === 'completed' ? new Date() : null;
            await payment.save();

            // Update donation status
            if (status === 'completed') {
                await Donation.findByIdAndUpdate(payment.donationId, { 
                    status: 'completed',
                    paymentMethod: payment.paymentMethod
                });
            }
        }

        res.json({
            status: payment.status,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            completedAt: payment.completedAt
        });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ message: 'Status check failed' });
    }
});

module.exports = router;
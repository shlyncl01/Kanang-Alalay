// routes/paymongoWebhook.js
//
// Handles PayMongo's `checkout_session.payment.paid` (and `.failed`) webhook
// for Part 9 (real Hosted Checkout donations). This is the ONLY place a
// donation is allowed to move from "pending" to "paid" — the frontend
// success_url redirect is never trusted for that (a donor can hit that URL
// without ever paying), per the task's explicit rule.
//
// IMPORTANT: this handler must be mounted with express.raw({ type:
// 'application/json' }) — and mounted BEFORE the app's global
// express.json() — so req.body is the untouched raw bytes PayMongo signed.
// See server.js.
const Donation = require('../models/Donation');
const paymentService = require('../services/paymentService');

// Best-effort mapping from PayMongo's payment source type to the donation's
// existing paymentMethod enum. Falls back to 'qrph' for anything unmapped
// rather than failing the whole webhook over a cosmetic field.
const PAYMONGO_SOURCE_TO_METHOD = {
    card: 'credit_card',
    gcash: 'gcash',
    paymaya: 'maya',
    qrph: 'qrph'
};

// PayMongo's webhook envelope has shown up in two documented shapes:
//  - { data: { type: 'checkout_session.payment.paid', data: {...session} } }
//  - { data: { id: 'evt_x', attributes: { type: '...', data: {...resource} } } }
// Handle both defensively instead of assuming one.
function parseEvent(body) {
    const outer = body?.data || {};
    if (typeof outer.type === 'string' && outer.type.includes('.')) {
        return { eventType: outer.type, resource: outer.data || null };
    }
    if (outer.attributes && typeof outer.attributes.type === 'string') {
        return { eventType: outer.attributes.type, resource: outer.attributes.data || null };
    }
    return { eventType: null, resource: null };
}

async function findDonationForSession(resource) {
    const donationId = resource?.attributes?.metadata?.donationId;
    if (donationId) {
        const byId = await Donation.findById(donationId).catch(() => null);
        if (byId) return byId;
    }
    const checkoutSessionId = resource?.id;
    if (checkoutSessionId) {
        const bySession = await Donation.findOne({ paymongoCheckoutSessionId: checkoutSessionId });
        if (bySession) return bySession;
    }
    return null;
}

module.exports = async function paymongoWebhookHandler(req, res) {
    try {
        const signatureHeader = req.headers['paymongo-signature'];
        const rawBody = req.body; // Buffer — see express.raw() in server.js

        if (!paymentService.verifyWebhookSignature(rawBody, signatureHeader)) {
            console.warn('[PayMongo Webhook] Signature verification failed');
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        let body;
        try {
            body = JSON.parse(rawBody.toString('utf8'));
        } catch {
            return res.status(400).json({ success: false, message: 'Malformed JSON payload' });
        }

        const { eventType, resource } = parseEvent(body);
        console.log('[PayMongo Webhook] Event received:', eventType);

        if (!eventType || !resource) {
            // Unrecognized shape — acknowledge so PayMongo doesn't keep retrying,
            // but don't touch any donation.
            return res.status(200).json({ success: true, message: 'Ignored (unrecognized payload)' });
        }

        const io = req.app.get('io');

        if (eventType === 'checkout_session.payment.paid') {
            const donation = await findDonationForSession(resource);
            if (!donation) {
                console.warn('[PayMongo Webhook] No matching donation for checkout session', resource?.id);
                return res.status(200).json({ success: true, message: 'No matching donation' });
            }

            // Idempotency: PayMongo retries webhooks until it gets a 200, and the
            // same event can legitimately be delivered more than once. Since a
            // donation only ever needs to be marked paid once, checking its
            // current status (persisted in Mongo) is a durable, restart-safe
            // guard — no in-memory dedupe needed.
            if (donation.paymentStatus === 'paid') {
                return res.status(200).json({ success: true, message: 'Already paid' });
            }

            const payments = resource.attributes?.payments || [];
            const payment = payments[0] || null;
            const sourceType = payment?.attributes?.source?.type;

            donation.paymentStatus = 'paid';
            donation.paymentMethod = PAYMONGO_SOURCE_TO_METHOD[sourceType] || donation.paymentMethod || 'qrph';
            donation.transactionId = payment?.id || donation.transactionId;
            donation.paymongoPaymentId = payment?.id || donation.paymongoPaymentId;
            donation.verified = true;
            donation.verificationDate = new Date();

            if (!donation.receiptNumber) {
                const date = new Date();
                const year = date.getFullYear().toString().slice(-2);
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const count = await Donation.countDocuments({ paymentStatus: 'paid' });
                donation.receiptNumber = `RCPT-${year}${month}-${String(count + 1).padStart(3, '0')}`;
            }

            await donation.save();
            console.log('[PayMongo Webhook] Donation marked PAID:', donation.donationId);

            if (io) io.emit('update_donation', donation);
        } else if (eventType === 'checkout_session.payment.failed') {
            const donation = await findDonationForSession(resource);
            if (donation && donation.paymentStatus === 'pending') {
                donation.paymentStatus = 'failed';
                await donation.save();
                if (io) io.emit('update_donation', donation);
            }
        }
        // Any other event type is acknowledged and ignored — we only subscribe
        // to checkout_session.payment.paid in the PayMongo dashboard, but stay
        // defensive in case more events get added to that webhook later.

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[PayMongo Webhook] Error:', error);
        // 500 tells PayMongo to retry the delivery later.
        res.status(500).json({ success: false, message: 'Webhook processing error' });
    }
};
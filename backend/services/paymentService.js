const axios = require('axios');
const crypto = require('crypto');

class PaymentService {
    constructor() {
        // Support both naming conventions: PAYMONGO_SECRET_KEY (what's actually
        // set in this project's Render env) and PAYMENT_GATEWAY_API_KEY (the
        // generic name the original paymentService.js used).
        this.apiKey = process.env.PAYMONGO_SECRET_KEY || process.env.PAYMENT_GATEWAY_API_KEY;
        this.baseURL = 'https://api.paymongo.com/v1';
        // Hosted Checkout uses PayMongo's newer /v2 Checkout Session API, which
        // defers Payment Intent creation until the donor actually pays (this is
        // the version PayMongo recommends for new integrations).
        this.baseURLv2 = 'https://api.paymongo.com/v2';
    }

    _authHeader() {
        return `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`;
    }

    // ── Hosted Checkout (Part 9) ────────────────────────────────────────────
    // Creates a PayMongo Checkout Session for a donation and returns the
    // hosted checkout_url to redirect the donor to. The secret key never
    // leaves this backend service.
    async createCheckoutSession({ amount, donationId, referenceNumber, donorName, donorEmail, successUrl, cancelUrl }) {
        const payload = {
            data: {
                attributes: {
                    line_items: [
                        {
                            name: 'Donation to Kanang Alalay',
                            amount, // centavos
                            currency: 'PHP',
                            quantity: 1
                        }
                    ],
                    payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
                    success_url: successUrl,
                    cancel_url: cancelUrl,
                    reference_number: referenceNumber,
                    send_email_receipt: true,
                    billing: {
                        name: donorName,
                        email: donorEmail
                    },
                    metadata: {
                        donationId: String(donationId)
                    }
                }
            }
        };

        const response = await axios.post(
            `${this.baseURLv2}/checkout_sessions`,
            payload,
            {
                headers: {
                    'Authorization': this._authHeader(),
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.data; // { id: 'cs_xxx', attributes: { checkout_url, ... } }
    }

    async retrieveCheckoutSession(checkoutSessionId) {
        const response = await axios.get(
            `${this.baseURLv2}/checkout_sessions/${checkoutSessionId}`,
            { headers: { 'Authorization': this._authHeader() } }
        );
        return response.data.data;
    }

    // Only used for gateway-based methods (gcash, maya, credit_card, bank_transfer)
    async createPaymentIntent(data) {
        const payload = {
            data: {
                attributes: {
                    amount: data.amount,
                    currency: 'PHP',
                    payment_method_allowed: [data.paymentMethod],
                    payment_method_options: {
                        card: {
                            request_three_d_secure: 'any'
                        }
                    },
                    metadata: data.metadata
                }
            }
        };

        const response = await axios.post(
            `${this.baseURL}/payment_intents`,
            payload,
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.data;
    }

    async checkPaymentStatus(paymentIntentId) {
        const response = await axios.get(
            `${this.baseURL}/payment_intents/${paymentIntentId}`,
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`
                }
            }
        );

        return response.data.data.attributes.status;
    }

    // Verifies PayMongo's "Paymongo-Signature" header, which looks like:
    //   t=1496734173,te=1447a89e...,li=3f7bs59d...
    // `payload` MUST be the raw, unparsed request body (a Buffer or the exact
    // string PayMongo sent) — parsing/re-stringifying it first will change the
    // bytes being signed and always fail verification.
    // See: https://developers.paymongo.com/docs/securing-webhook
    verifyWebhookSignature(payload, signatureHeader) {
        const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;
        if (!signatureHeader || !webhookSecret) return false;

        const parts = {};
        for (const segment of signatureHeader.split(',')) {
            const [key, value] = segment.split('=');
            if (key && value) parts[key.trim()] = value.trim();
        }
        const { t: timestamp, te: testSig, li: liveSig } = parts;
        if (!timestamp || (!testSig && !liveSig)) return false;

        const rawBody = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
        const signedPayload = `${timestamp}.${rawBody}`;
        const expected = crypto
            .createHmac('sha256', webhookSecret)
            .update(signedPayload)
            .digest('hex');

        // Live mode uses `li`, test mode uses `te`. Accept whichever is present
        // and matches — a real PayMongo event only ever includes the signature
        // that's relevant to the mode the webhook secret was issued for.
        const candidates = [testSig, liveSig].filter(Boolean);
        return candidates.some((sig) => {
            const a = Buffer.from(expected, 'hex');
            const b = Buffer.from(sig, 'hex');
            return a.length === b.length && crypto.timingSafeEqual(a, b);
        });
    }

    isManualMethod(paymentMethod) {
        return ['qrph', 'cash'].includes(paymentMethod);
    }
}

module.exports = new PaymentService();
const axios = require('axios');
const crypto = require('crypto');

class PaymentService {
    constructor() {
        this.apiKey = process.env.PAYMENT_GATEWAY_API_KEY;
        this.baseURL = 'https://api.paymongo.com/v1';
    }

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

    verifyWebhookSignature(payload, signature) {
        const hmac = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET);
        const digest = hmac.update(payload).digest('hex');
        return digest === signature;
    }
}

module.exports = new PaymentService();
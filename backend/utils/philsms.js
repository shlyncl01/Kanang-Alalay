// backend/utils/philsms.js
//
// Minimal wrapper around the PhilSMS v3 SMS API.
// Docs: https://app.philsms.com/developers/documentation
//
//   POST https://app.philsms.com/api/v3/sms/send
//   Headers: Authorization: Bearer {PHILSMS_API_TOKEN}, Content-Type: application/json, Accept: application/json
//   Body:    { recipient, sender_id, type: "plain", message }
//   Success: { "status": "success", "data": ... }
//   Failure: { "status": "error", "message": "..." }
//
// SECURITY:
//   - The API token is read only from process.env.PHILSMS_API_TOKEN.
//   - It is NEVER logged, returned in a response, or embedded in any message text.
//   - This module is backend-only; it must never be imported into frontend code.

const PHILSMS_SEND_URL = 'https://app.philsms.com/api/v3/sms/send';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Converts an already-validated PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)
 * into the "639XXXXXXXXX" recipient format PhilSMS expects.
 */
function toPhilSmsRecipient(phone) {
    const trimmed = String(phone).replace(/[\s\-()]/g, '');
    if (trimmed.startsWith('+63')) return trimmed.slice(1);
    if (trimmed.startsWith('0')) return `63${trimmed.slice(1)}`;
    if (trimmed.startsWith('63')) return trimmed;
    return trimmed;
}

/**
 * Sends a single plain-text SMS through PhilSMS.
 *
 * @param {string} phone - PH mobile number in any of the app's accepted formats.
 * @param {string} message - SMS body (keep short; no vulgar words per PhilSMS policy).
 * @returns {Promise<object>} the PhilSMS response `data` payload on success.
 * @throws {Error} with a safe, provider-agnostic message on any failure. The
 *   error is annotated with `.code` for the caller to branch on if needed:
 *     'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'PROVIDER_ERROR'
 */
async function sendPhilSmsOtp(phone, message) {
    const apiToken = process.env.PHILSMS_API_TOKEN;
    const senderId = process.env.PHILSMS_SENDER_ID;

    if (!apiToken || !senderId) {
        const err = new Error('PhilSMS is not configured (missing PHILSMS_API_TOKEN or PHILSMS_SENDER_ID).');
        err.code = 'NOT_CONFIGURED';
        throw err;
    }

    const recipient = toPhilSmsRecipient(phone);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(PHILSMS_SEND_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                recipient,
                sender_id: senderId,
                type: 'plain',
                message,
            }),
            signal: controller.signal,
        });
    } catch (networkErr) {
        const err = new Error(
            networkErr.name === 'AbortError'
                ? 'PhilSMS request timed out.'
                : `PhilSMS network error: ${networkErr.message}`
        );
        err.code = networkErr.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
        throw err;
    } finally {
        clearTimeout(timeout);
    }

    let data = null;
    try {
        data = await response.json();
    } catch (_) {
        // Non-JSON body — fall through to the generic error below.
    }

    if (!response.ok || !data || data.status !== 'success') {
        // Never surface response.headers/body verbatim (could leak provider
        // internals) — only the human-readable message field, if present.
        const providerMessage = (data && data.message) || `PhilSMS request failed (HTTP ${response.status}).`;
        const err = new Error(providerMessage);
        err.code = 'PROVIDER_ERROR';
        err.httpStatus = response.status;
        throw err;
    }

    return data.data;
}

module.exports = { sendPhilSmsOtp, toPhilSmsRecipient };
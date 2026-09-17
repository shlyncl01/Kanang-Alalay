const ActivityLog = require('../models/ActivityLog');

/**
 * Part 15 — Audit Trail
 *
 * Thin wrapper around ActivityLog.create() used by every route that needs to
 * record an admin action. Centralizing it here (instead of repeating the
 * same object shape at every call site) means every entry consistently gets
 * the actor's id + role, and a write failure here can never fail the request
 * that triggered it — logging is always best-effort, matching the
 * `.catch(() => {})` pattern already used for ActivityLog.create() elsewhere
 * in adminRoutes.js.
 *
 * @param {import('express').Request} req - needs req.user (set by `protect`)
 * @param {Object} opts
 * @param {string} opts.action       - short machine code, e.g. 'INVENTORY_ITEM_ADDED'
 * @param {string} opts.module       - one of ActivityLog's `module` enum values
 * @param {string} opts.description  - human-readable sentence for the Description column
 * @param {string} [opts.status]     - 'success' (default) | 'failed'
 * @param {*}      [opts.targetId]   - id of the affected record, if any
 * @param {string} [opts.targetLabel]- human-readable name of the affected record
 * @param {string} [opts.targetModel]- e.g. 'User', 'Inventory', 'Booking'
 *
 * Also emits a 'new_audit_log' socket event (same io.emit() pattern used
 * throughout adminRoutes.js/bookingRoutes.js/etc.) so the Admin Audit Trail
 * tab can update live instead of only on manual refresh. The emit is
 * best-effort exactly like the write above — req may be a real Express
 * request or a minimal { user } stand-in (used for pre-auth events like
 * failed logins), so req.app may not exist; that's fine, it just means no
 * live push for that entry, the row itself is still safely on disk.
 */
async function logAudit(req, opts) {
    try {
        const entry = await ActivityLog.create({
            action: opts.action,
            details: opts.description,
            user: req.user?._id,
            role: req.user?.role || null,
            module: opts.module || 'Other',
            status: opts.status || 'success',
            targetId: opts.targetId || undefined,
            targetLabel: opts.targetLabel || '',
            targetModel: opts.targetModel || '',
        });

        try {
            const io = req?.app?.get?.('io');
            if (io) {
                // Populate the same 'user' fields the GET /admin/audit-trail
                // list uses, so the row the frontend receives over the socket
                // renders identically to one it would get from a page fetch.
                await entry.populate('user', 'firstName lastName role username');
                io.emit('new_audit_log', entry);
            }
        } catch (emitErr) {
            console.error('[AuditLog] Failed to emit real-time update:', emitErr.message);
        }
    } catch (err) {
        // Never let a logging failure affect the outcome of the action that
        // triggered it — just surface it loudly in the server logs so a
        // missing audit entry can be noticed and investigated.
        console.error('[AuditLog] Failed to write log entry:', err.message);
    }
}

module.exports = { logAudit };
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── protect ──────────────────────────────────────────────────────────────────
// Verifies the JWT in the Authorization header and attaches the user to req.
// Every protected route uses this middleware first.
const protect = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user    = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists.' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Your account is inactive. Please contact an administrator.' });
        }

        req.user  = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
        }
        res.status(401).json({ success: false, message: 'Authentication failed.' });
    }
};

// ── adminOnly ─────────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

// ── roleMiddleware ────────────────────────────────────────────────────────────
const roleMiddleware = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${roles.join(', ')}.`
            });
        }
        next();
    };
};

// ── Legacy alias so older code that imports authMiddleware still works ─────────
const authMiddleware = protect;

module.exports = { protect, adminOnly, roleMiddleware, authMiddleware };
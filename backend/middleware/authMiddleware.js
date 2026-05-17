const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'ka_token';

const protect = async (req, res, next) => {
    try {
        // Accept token from httpOnly cookie OR Authorization Bearer header
        let token = req.cookies?.[COOKIE_NAME];

        if (!token) {
            const authHeader = req.headers['authorization'] || req.headers['Authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            console.error('Auth protect: missing token');
            return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
        }

        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists.' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Your account is inactive. Please contact an administrator.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth protect error:', error.name, error.message);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
        }
        res.status(401).json({ success: false, message: 'Authentication failed.' });
    }
};

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

const headCaregiverOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'head_caregiver') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Head Caregiver privileges required.'
        });
    }
    next();
};

const adminOrHeadCaregiver = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'head_caregiver')) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin or Head Caregiver privileges required.'
        });
    }
    next();
};

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

const authMiddleware = protect;

module.exports = { protect, adminOnly, roleMiddleware, authMiddleware, headCaregiverOnly, adminOrHeadCaregiver };
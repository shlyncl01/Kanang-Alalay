const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'User not found or inactive' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

const roleMiddleware = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

module.exports = { authMiddleware, roleMiddleware };
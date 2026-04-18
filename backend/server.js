require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const { Server } = require('socket.io');

// ── Models ────────────────────────────────────────────────────────────────────
const Donation  = require('./models/Donation');
const Booking   = require('./models/Booking');
const Inventory = require('./models/Inventory'); // FIX: added for /api/inventory route

// ── Route Files ───────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const alertRoutes    = require('./routes/alertRoutes');
const bookingRoutes  = require('./routes/bookingRoutes');
const donationRoutes = require('./routes/donationRoutes');
const paymentRoutes  = require('./routes/PaymentRoutes');

const app = express();

// ==================== SOCKET.IO SETUP ========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app',
            'https://lsae-kanangalalay.online',
        ],
        methods:     ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`⚡ Client connected to Socket.io: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// ==================== MIDDLEWARE =============================================
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://kanang-alalay.vercel.app',
    'https://lsae-kanangalalay.online',
    'http://localhost:3000'
].filter(Boolean);

const isLocalDevOrigin = (origin = '') =>
    /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

app.use(cors({
    origin: (origin, callback) => {
        // allow non-browser tools / same-origin
        if (!origin) return callback(null, true);
        if (isLocalDevOrigin(origin)) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== STATIC FILE SERVING (uploads) ==========================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory:', uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// ==================== MONGODB CONNECTION =====================================
console.log('🔗 Attempting to connect to MongoDB Atlas...');
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS:          45000,
    family:                   4
}).then(() => {
    console.log('✅ MongoDB Atlas connected successfully!');
}).catch((err) => {
    console.error(`❌ Connection failed: ${err.message}`);
    process.exit(1);
});

// ==================== ROOT & HEALTH ROUTES ===================================
app.get('/', (req, res) => {
    res.json({
        message:   'Kanang-Alalay Backend API is running!',
        status:    'active',
        endpoints: {
            health:    '/api/health',
            auth:      '/api/auth',
            bookings:  '/api/bookings',
            donations: '/api/donations',
            payments:  '/api/payments',
            alerts:    '/api/alerts',
            admin:     '/api/admin',
            stats:     '/api/stats'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status:   'healthy',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ==================== MOUNT API ROUTES =======================================
app.use('/api/auth',      authRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/bookings',  bookingRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/payments',  paymentRoutes);

// ==================== STATS ==================================================
app.get('/api/stats', async (req, res) => {
    try {
        const [totalDonations, pendingBookings, donationAgg] = await Promise.all([
            Donation.countDocuments(),
            Booking.countDocuments({ status: 'pending' }),
            // FIX: compute real total donation amount
            Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);
        const totalDonationAmount = donationAgg[0]?.total || 0;
        res.json({
            success: true,
            data: {
                totalResidents: 71,
                pendingBookings,
                totalDonations,
                totalDonationAmount, // FIX: was missing — dashboard shows ₱0 without this
                lowStockItems: 5
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

// ==================== INVENTORY ROUTES ====================
// Make sure inventory routes are properly mounted
app.get('/api/inventory', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const items = await Inventory.find().limit(limit).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Inventory fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching inventory' });
    }
});

app.post('/api/inventory', async (req, res) => {
    try {
        const item = new Inventory({
            ...req.body,
            itemId: `INV-${Date.now().toString().slice(-6)}`
        });
        await item.save();
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Inventory create error:', error);
        res.status(500).json({ success: false, message: 'Error adding inventory item' });
    }
});

app.put('/api/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
        res.json({ success: true, data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating inventory item' });
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    try {
        await Inventory.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting inventory item' });
    }
});

// ==================== EMAIL SEND ROUTE (for booking rejection) ====================
app.post('/api/email/send-booking-status', async (req, res) => {
    try {
        const { to, status, bookingDetails, reason } = req.body;
        const { sendEmail, generateBookingConfirmationTemplate, generateBookingRejectionTemplate } = require('./models/mailer');
        
        if (status === 'approved') {
            await sendEmail(to, 'Booking Confirmed - Kanang Alalay', 
                generateBookingConfirmationTemplate({ ...bookingDetails, email: to }));
        } else if (status === 'rejected') {
            await sendEmail(to, 'Booking Update - Kanang Alalay', 
                generateBookingRejectionTemplate({ ...bookingDetails, email: to }, reason));
        }
        
        res.json({ success: true, message: 'Email sent' });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ERROR HANDLING =========================================
app.use((req, res) =>
    res.status(404).json({ success: false, message: 'Endpoint not found' })
);
app.use((err, req, res, next) =>
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message })
);

// ==================== START SERVER ===========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
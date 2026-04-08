require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const http      = require('http');
const { Server } = require('socket.io');

// ── Validate required env vars ────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables!');
    process.exit(1);
}

// ── Models ────────────────────────────────────────────────────────────────────
const Donation = require('./models/Donation');
const Booking  = require('./models/Booking');

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
        origin:      process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app',
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
app.use(cors({
    origin:         process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app',
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        const [totalDonations, pendingBookings] = await Promise.all([
            Donation.countDocuments(),
            Booking.countDocuments({ status: 'pending' })
        ]);
        res.json({
            success: true,
            data: { totalResidents: 71, pendingBookings, totalDonations, lowStockItems: 5 }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

// ==================== UPDATE BOOKING STATUS ==================================
app.put('/api/bookings/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== UPDATE DONATION PAYMENT STATUS =========================
app.put('/api/donations/:id/payment', async (req, res) => {
    try {
        const { paymentStatus } = req.body;
        const donation = await Donation.findByIdAndUpdate(
            req.params.id,
            { paymentStatus },
            { new: true }
        );
        res.json({ success: true, data: donation });
    } catch (error) {
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
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
const Inventory = require('./models/Inventory');

// ── Route Files ───────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const alertRoutes    = require('./routes/alertRoutes');
const bookingRoutes  = require('./routes/bookingRoutes');
const donationRoutes = require('./routes/donationRoutes');
const paymentRoutes  = require('./routes/PaymentRoutes');
const nurseRoutes       = require('./routes/nurseRoutes');
const residentRoutes    = require('./routes/residentRoutes');
const medicationRoutes  = require('./routes/medicationRoutes');

const app = express();

// ==================== SOCKET.IO SETUP ========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || 'https://kanang-alalay.vercel.app',
            'https://lsae-kanangalalay.online',
            'http://localhost:3000'
        ],
        methods:     ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`⚡ Socket.io connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`❌ Socket.io disconnected: ${socket.id}`));
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

// ==================== STATIC FILE SERVING ====================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ==================== MONGODB CONNECTION =====================================
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
        version:   '2.0',
        endpoints: {
            health:    '/api/health',
            auth:      '/api/auth',
            bookings:  '/api/bookings',
            donations: '/api/donations',
            payments:  '/api/payments',
            alerts:    '/api/alerts',
            admin:     '/api/admin',
            stats:     '/api/stats',
            inventory: '/api/inventory'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status:   'healthy',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime:   process.uptime()
    });
});

// ==================== MOUNT API ROUTES =======================================
app.use('/api/auth',      authRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/bookings',  bookingRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/nurse',     nurseRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/medications', medicationRoutes);

// ==================== STATS (FIXED: lowStockItems from real DB) ==============
app.get('/api/stats', async (req, res) => {
    try {
        const [totalDonations, pendingBookings, donationAgg, inventoryItems] = await Promise.all([
            Donation.countDocuments(),
            Booking.countDocuments({ status: 'pending' }),
            Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Inventory.find({}, { quantity: 1, minThreshold: 1 })
        ]);

        // FIXED: was hardcoded 5, now computed from real inventory data
        const lowStockItems = inventoryItems.filter(
            i => i.quantity <= (i.minThreshold ?? 10)
        ).length;

        const totalDonationAmount = donationAgg[0]?.total || 0;
        res.json({
            success: true,
            data: {
                totalResidents: 71,
                pendingBookings,
                totalDonations,
                totalDonationAmount,
                lowStockItems
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

// ==================== INVENTORY ROUTES (public fallback) =====================
app.get('/api/inventory', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const items = await Inventory.find().limit(limit).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
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

// ==================== EMAIL SEND ROUTE =======================================
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
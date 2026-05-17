require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');

const Donation = require('./models/Donation');
const Booking = require('./models/Booking');
const Inventory = require('./models/Inventory');
const User = require('./models/User');
const Medication = require('./models/Medication');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const alertRoutes = require('./routes/alertRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const donationRoutes = require('./routes/donationRoutes');
const paymentRoutes = require('./routes/PaymentRoutes');
const headCaregiverRoutes = require('./routes/headCaregiverRoutes');
const residentRoutes = require('./routes/residentRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://kanang-alalay.vercel.app',
    'https://kanang-alalay-shlyncl01s-projects.vercel.app',
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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });
app.use('/uploads', express.static(uploadsDir));

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4
}).then(async () => {
    console.log('MongoDB Atlas connected successfully!');
    try {
    const defaultUsers = [
        {
            staffId: 'LSAE-ADMIN-0001',
            username: 'admin',
            email: 'admin@kanangalalay.org',
            password: await bcrypt.hash('admin123', 10),
            firstName: 'Sandra',
            lastName: 'Da Silva',
            role: 'admin',
            isActive: true,
            isVerified: true,
            isFirstLogin: false,       
            needsProfileUpdate: false,   
            status: 'active',            
            shift: 'morning',
            department: 'Head Office'
        },
        {
            staffId: 'LSAE-HC-0001',
            username: 'headcaregiver',
            email: 'headcaregiver@kanangalalay.org',
            password: await bcrypt.hash('headcaregiver123', 10),
            firstName: 'Head',
            lastName: 'Caregiver',
            role: 'head_caregiver',
            isActive: true,
            isVerified: true,
            isFirstLogin: false,        
            needsProfileUpdate: false,   
            status: 'active',            
            shift: 'morning',
            department: 'Care Management'
        },
        {
            staffId: 'LSAE-CG-0001',
            username: 'caregiver',
            email: 'caregiver@kanangalalay.org',
            password: await bcrypt.hash('caregiver123', 10),
            firstName: 'Default',
            lastName: 'Caregiver',
            role: 'caregiver',
            isActive: true,
            isVerified: true,
            isFirstLogin: false,        // ← ADD THIS
            needsProfileUpdate: false,   // ← ADD THIS
            status: 'active',            // ← ADD THIS
            shift: 'morning',
            department: 'Ward A'
        }
    ];

        for (const userData of defaultUsers) {
            const existing = await User.findOne({ $or: [{ username: userData.username }, { email: userData.email }] });
            if (existing) {
                existing.staffId = existing.staffId || userData.staffId;
                existing.firstName = existing.firstName || userData.firstName;
                existing.lastName = existing.lastName || userData.lastName;
                existing.role = existing.role || userData.role;
                existing.isActive = true;
                existing.isVerified = true;
                existing.isFirstLogin = false;      // ← ADD THIS
                existing.needsProfileUpdate = false; // ← ADD THIS
                existing.status = 'active';          // ← ADD THIS
                existing.shift = existing.shift || userData.shift;
                existing.department = existing.department || userData.department;
                if (userData.password) {
                    existing.password = userData.password;
                }
                await existing.save();
                continue;
            }

            const user = new User(userData);
            await user.save();
        }
        console.log('✅ Default backend users ensured.');
        try {
            const defaultMedication = {
                medicationId: 'TYLENOL_ACETAMINOPHEN_500MG',
                uniqueCode: '300450449092',
                barcode: '300450449092',
                name: 'Tylenol (Acetaminophen) 500mg',
                genericName: 'Acetaminophen',
                dosage: { value: 500, unit: 'mg' },
                strength: '500mg',
                form: 'tablet',
                route: 'Oral',
                manufacturer: 'Johnson & Johnson',
                ndc: '30045-0444-39',
                purpose: 'Temporarily relieves minor aches and pains due to headache, muscular aches, backache, minor pain of arthritis, the common cold, toothache, and premenstrual and menstrual cramps. Temporarily reduces fever.',
                instructions: 'Adults and children 12 years and over: Take 2 tablets every 4 to 6 hours while symptoms last. Do not take more than 8 tablets in 24 hours. Children under 12 years: Ask a doctor.',
                warnings: 'Liver warning: This product contains acetaminophen. Severe liver damage may occur if you take more than 8 tablets in 24 hours, with other drugs containing acetaminophen, or if you drink 3 or more alcoholic drinks daily while using this product.',
                sideEffects: 'Acetaminophen may cause severe skin reactions. Stop use and ask a doctor immediately if you develop skin redness, blistering, or rash.',
                contraindications: 'Do not use if you have severe liver disease or are allergic to acetaminophen.',
                drugInteractions: 'Ask a doctor before use if you are taking the blood thinning drug warfarin, other drugs containing acetaminophen, or if you have liver disease.',
                pregnancy: 'If pregnant or breast-feeding, ask a health professional before use.',
                storage: 'Store at room temperature between 20-25°C (68-77°F). Avoid high humidity.',
                stock: {
                    current: 100,
                    minimum: 10,
                    maximum: 200,
                    unit: 'tablet'
                },
                isActive: true
            };

            const existingMedication = await Medication.findOne({
                $or: [
                    { uniqueCode: defaultMedication.uniqueCode },
                    { barcode: defaultMedication.barcode },
                    { medicationId: defaultMedication.medicationId }
                ]
            });

            if (!existingMedication) {
                await new Medication(defaultMedication).save();
                console.log('✅ Default medication seeded: Tylenol (Acetaminophen) 500mg');
            } else {
                console.log('✅ Default medication already exists.');
            }
        } catch (medSeedError) {
            console.error('Failed to seed default medication:', medSeedError);
        }
    } catch (seedError) {
        console.error('Failed to seed default users:', seedError);
    }
}).catch((err) => {
    console.error(`Connection failed: ${err.message}`);
    process.exit(1);
});

app.get('/', (req, res) => {
    res.json({
        message: 'Kanang-Alalay Backend API is running!',
        status: 'active',
        version: '2.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            bookings: '/api/bookings',
            donations: '/api/donations',
            payments: '/api/payments',
            alerts: '/api/alerts',
            admin: '/api/admin',
            stats: '/api/stats',
            inventory: '/api/inventory',
            headCaregiver: '/api/head-caregiver',
            residents: '/api/residents',
            medications: '/api/medications'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users',  userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/head-caregiver', headCaregiverRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/medications', medicationRoutes);

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

        const lowStockItems = inventoryItems.filter(
            i => i.quantity <= (i.minThreshold ?? 10)
        ).length;

        res.json({
            success: true,
            data: {
                totalResidents: 71,
                pendingBookings,
                totalDonations,
                totalDonationAmount: donationAgg[0]?.total || 0,
                lowStockItems
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const items = await Inventory.find().limit(limit).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching inventory' });
    }
});

app.get('/api/inventory/low-stock', async (req, res) => {
    try {
        const items = await Inventory.find();
        const lowStockItems = items.filter(item => item.quantity <= (item.minThreshold ?? 10));
        res.json({ success: true, data: lowStockItems });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching low stock inventory' });
    }
});

app.post('/api/inventory', async (req, res) => {
    try {
        const item = new Inventory({
            name: req.body.name,
            quantity: req.body.quantity || 0,
            unit: req.body.unit || 'pcs',
            category: req.body.category || 'General',
            minThreshold: req.body.minThreshold || 10,
            expirationDate: req.body.expirationDate,
            notes: req.body.notes
        });
        await item.save();
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Inventory create error:', error);
        console.error('Inventory create request body:', req.body);
        const message = error.code === 11000 ? 'Duplicate inventory identifier. Please retry.' : 'Error adding inventory item';
        res.status(500).json({ success: false, message, error: error.message });
    }
});

app.post('/api/inventory/scan', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Scan code is required.' });
        }

        const scanCode = code.toString().trim().toUpperCase();
        const item = await Inventory.findOne({
            $or: [
                { itemId: scanCode },
                { qrCode: scanCode },
                { _id: mongoose.Types.ObjectId.isValid(scanCode) ? scanCode : null }
            ].filter(Boolean)
        });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Inventory item not found for provided code.' });
        }

        if (item.quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Inventory stock is depleted.' });
        }

        item.quantity -= 1;
        await item.save();

        res.json({ success: true, data: item, message: 'Inventory item scanned and stock decremented.' });
    } catch (error) {
        console.error('Inventory scan error:', error);
        res.status(500).json({ success: false, message: 'Server error while processing inventory scan.' });
    }
});

app.get('/api/inventory/:id/qr', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await Inventory.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Inventory item not found.' });
        }

        const qrCodeText = item.qrCode;
        const qrCodeDataURL = await qrcode.toDataURL(qrCodeText, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Convert data URL to buffer
        const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'inline; filename="qr-code.png"');
        res.send(buffer);
    } catch (error) {
        console.error('QR code generation error:', error);
        res.status(500).json({ success: false, message: 'Error generating QR code.' });
    }
});

app.post('/api/voice/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ success: false, message: 'OpenAI API key is not configured.' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No audio file uploaded.' });
        }

        const audioBuffer = fs.readFileSync(req.file.path);
        const audioBlob = new Blob([audioBuffer], { type: req.file.mimetype });

        const formData = new FormData();
        formData.append('file', audioBlob, req.file.originalname);
        formData.append('model', 'whisper-1');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
        });

        const result = await response.json();

        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.warn('Audio temp file cleanup failed:', unlinkErr);
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: result.error?.message || 'Audio transcription failed.',
                error: result,
            });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Voice transcription error:', error);
        if (req.file) {
            fs.unlink(req.file.path, () => {})
        }
        res.status(500).json({ success: false, message: 'Server error transcribing audio.' });
    }
});

app.post('/api/voice/respond', async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ success: false, message: 'OpenAI API key is not configured.' });
        }

        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message text is required.' });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful medication assistant for the Kanang-Alalay caregiving system. You have access to information about the backend system including:

SYSTEM CAPABILITIES:
- User management: Admin, Head Caregiver, Caregiver roles
- Inventory management: Track medications, supplies, quantities, expiration dates
- Resident management: Patient records, care plans
- Booking system: Appointment scheduling and management
- Donation tracking: Financial contributions and records
- Medication administration: Logging and monitoring
- Alert system: Notifications for low stock, medication reminders
- Payment processing: Transaction handling

CURRENT SYSTEM FEATURES:
- QR code generation for inventory items
- Real-time notifications via Socket.io
- Role-based access control
- Voice transcription and response generation
- Multi-platform support (web, mobile)

As a medication assistant, provide safe, accurate information about medications, administration guidelines, and general caregiving practices. Always emphasize safety and consulting healthcare professionals for medical decisions.

If asked about system capabilities or data, explain what the Kanang-Alalay system can do based on the above features.`,
                    },
                    {
                        role: 'user',
                        content: message,
                    },
                ],
                temperature: 0.7,
                max_tokens: 500,
            }),
        });

        const result = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: result.error?.message || 'OpenAI response generation failed.',
                error: result,
            });
        }

        const reply = result.choices?.[0]?.message?.content?.trim() || '';
        res.json({ success: true, data: { text: reply, raw: result } });
    } catch (error) {
        console.error('Voice response error:', error);
        res.status(500).json({ success: false, message: 'Server error generating OpenAI response.' });
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

app.use((req, res) =>
    res.status(404).json({ success: false, message: 'Endpoint not found' })
);
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize socket.io
const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
            if (isLocalDevOrigin) return callback(null, true);
            const allowedOrigins = [
                process.env.FRONTEND_URL,
                'https://kanang-alalay.vercel.app',
                'https://lsae-kanangalalay.online'
            ].filter(Boolean);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(null, true); // Allow for development
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Socket.io event handlers
io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
    });
    
    socket.on('message', (data) => {
        console.log('[Socket] Message received:', data);
        io.emit('message', data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io ready for connections at port ${PORT}`);
});
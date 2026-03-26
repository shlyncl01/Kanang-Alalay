require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');  
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();

// In your backend server.js
const cors = require('cors');
app.use(cors({
    origin: 'http://localhost:3000', // Your React app URL
    credentials: true
}));

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // <-- This must come BEFORE routes

// Import the routes (adjust path as needed)
// const donationRoutes = require('./routes/donationRoutes');

// Register the routes
// app.use('/api', donationRoutes);

// ==================== MONGODB CONNECTION FIX ====================

// Connect to MongoDB Atlas with better options for mobile hotspot
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Capstone_DB:INF233@cluster0.4zhzwkr.mongodb.net/kanang-alalay?retryWrites=true&w=majority';

console.log('🔗 Attempting to connect to MongoDB Atlas...');

// Improved connection options for mobile networks
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // 10 seconds timeout for server selection
    socketTimeoutMS: 45000, // 45 seconds socket timeout
    connectTimeoutMS: 10000, // 10 seconds connection timeout
    family: 4, // Use IPv4, skip trying IPv6 (important for mobile networks)
    tls: true, // Enable TLS/SSL
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
    retryWrites: true,
    w: 'majority'
};

// Connect with better error handling and retry logic
async function connectWithRetry() {
    let retries = 3;
    
    while (retries > 0) {
        try {
            console.log(`🔄 Connection attempt ${4 - retries}/3...`);
            
            await mongoose.connect(MONGODB_URI, mongooseOptions);
            
            console.log('✅ MongoDB Atlas connected successfully!');
            console.log(`📊 Database: ${mongoose.connection.db ? mongoose.connection.db.databaseName : 'connecting...'}`);
            console.log(`🏠 Host: ${mongoose.connection.host}`);
            
            // Test the connection
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log(`🗂️  Collections found: ${collections.length}`);
            
            return true;
            
        } catch (error) {
            retries--;
            console.error(`❌ Connection failed: ${error.message}`);
            
            if (retries > 0) {
                console.log(`⏳ Retrying in 3 seconds... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.log('⚠️ All connection attempts failed. Using in-memory data storage instead.');
                return false;
            }
        }
    }
}

// Start connection
connectWithRetry().then(connected => {
    if (!connected) {
        console.log('💾 Running in in-memory mode. Some features may be limited.');
    }
});

// ==================== MONGODB SCHEMAS ====================

const donationSchema = new mongoose.Schema({
    donationId: {
        type: String,
        unique: true,
        sparse: true
    },
    donorName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: String,
    amount: {
        type: Number,
        min: 100,
        required: true
    },
    donationType: {
        type: String,
        enum: ['online', 'bank_transfer', 'cash', 'check'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer', 'paypal', 'cash', null]
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },
    transactionId: String,
    paymentIntentId: String,
    checkoutUrl: String,
    receiptNumber: String,
    designation: {
        type: String,
        enum: ['general', 'medical', 'food', 'facility', 'staff', 'other'],
        default: 'general'
    },
    notes: String,
    anonymous: {
        type: Boolean,
        default: false
    },
    // For bank transfers
    bankAccount: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        referenceNumber: String
    },
    // For cash/check appointments
    appointmentDate: Date,
    appointmentTime: String
}, {
    timestamps: true
});

donationSchema.pre('save', async function(next) {
    if (!this.donationId) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const count = await this.constructor.countDocuments({
            createdAt: { $gte: startOfMonth }
        });
        
        this.donationId = `DN${year}${month}${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);

const bookingSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true
    },
    residentName: String,
    visitDate: {
        type: Date,
        required: true
    },
    visitTime: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['tour', 'volunteer', 'donation', 'meeting', 'family_visit', 'inspection'],
        required: true
    },
    numberOfVisitors: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed', 'confirmed'],
        default: 'pending'
    },
    notes: String,
    approvedBy: String,
    approvalDate: Date,
    rejectionReason: String
}, {
    timestamps: true
});

// Virtual for booking ID
bookingSchema.virtual('bookingId').get(function() {
    const date = new Date(this.createdAt);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const idNum = this._id.toString().slice(-4);
    return `BK${year}${month}${idNum}`;
});

bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'nurse', 'caregiver', 'staff'],
        default: 'staff'
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    phone: String,
    shift: {
        type: String,
        enum: ['morning', 'afternoon', 'night', null],
        default: null
    },
    ward: String,
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,
    verificationToken: String,
    verificationExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    otp: String,
    otpExpires: Date
}, {
    timestamps: true
});

// Add password comparison method
userSchema.methods.comparePassword = async function(password) {
    return this.password === password;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

const registrationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    role: {
        type: String,
        enum: ['admin', 'nurse', 'caregiver', 'staff'],
        required: true
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
    },
    status: {
        type: String,
        enum: ['active', 'used', 'expired', 'revoked'],
        default: 'active'
    },
    usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    usedAt: Date
});

const RegistrationCode = mongoose.models.RegistrationCode || mongoose.model('RegistrationCode', registrationCodeSchema);

// ==================== ROUTES ====================

// Health check
app.get('/', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({ 
        message: 'Welcome to Kanang-Alalay API',
        version: '1.0.0',
        database: dbStatus,
        endpoints: [
            'GET  /api/health',
            'POST /api/auth/login',
            'POST /api/donations',
            'GET  /api/donations',
            'POST /api/bookings',
            'GET  /api/bookings',
            'GET  /api/stats',
            'GET  /api/admin/users',
            'POST /api/auth/register',
            'POST /api/auth/verify-otp',
            'POST /api/auth/forgot-password',
            'POST /api/auth/reset-password/:token',
            'POST /api/auth/register-staff',
            'GET  /api/admin/registration-codes',
            'POST /api/admin/generate-codes',
            'POST /api/auth/validate-code'
        ]
    });
});

app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
        success: true,
        status: 'healthy',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

app.get('/api', (req, res) => {
    res.json({ 
        success: true,
        message: 'Kanang-Alalay API',
        version: '1.0.0',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ==================== AUTH ROUTES ====================

// SEND OTP EMAIL ROUTE 
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email, userId } = req.body;
        
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, message: 'OTP simulated (DB not connected)' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        await user.save();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #b85c2d; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Kanang-Alalay</h1>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                    <h2 style="color: #333333; margin-top: 0;">Account Activation</h2>
                    <p style="color: #555555; font-size: 16px;">Here is your 6-digit OTP:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #b85c2d; background-color: #f9f2ef; padding: 15px 30px; border-radius: 8px; border: 2px dashed #b85c2d;">${otp}</span>
                    </div>
                    <p style="color: #777777; font-size: 14px; text-align: center;">This code will expire in 15 minutes.</p>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: `"Kanang Alalay Admin" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Account Activation OTP - Kanang Alalay',
            html: html
        });

        res.json({ success: true, message: 'OTP sent successfully' });

    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ success: false, message: 'Server error sending OTP' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, role, phone } = req.body;
        
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                success: false,
                message: 'Database not connected. Please try again later.' 
            });
        }
        
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'User with this email or username already exists' 
            });
        }

        const user = new User({
            username,
            email,
            password,
            firstName,
            lastName,
            role: role || 'staff',
            phone,
            isVerified: true
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            userId: user._id
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error during registration',
            error: error.message 
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Check database connection first
        const dbConnected = mongoose.connection.readyState === 1;
        let user = null;
        
        if (dbConnected) {
            user = await User.findOne({ 
                $or: [
                    { username: username },
                    { email: username }
                ],
                isActive: true 
            });
        }
        
        // If no user found in DB or DB not connected, use mock users
        if (!user) {
            const mockUsers = {
                'admin': { 
                    _id: 'mock-admin-id',
                    password: 'admin123', 
                    role: 'admin', 
                    firstName: 'Admin', 
                    lastName: 'User',
                    email: 'admin@lsae.org',
                    username: 'admin',
                    isVerified: true
                },
                'nurse': { 
                    _id: 'mock-nurse-id',
                    password: 'nurse123', 
                    role: 'nurse', 
                    firstName: 'Nurse', 
                    lastName: 'User',
                    email: 'nurse@lsae.org',
                    username: 'nurse',
                    isVerified: true
                },
                'caregiver': { 
                    _id: 'mock-caregiver-id',
                    password: 'care123', 
                    role: 'caregiver', 
                    firstName: 'Care', 
                    lastName: 'Giver',
                    email: 'caregiver@lsae.org',
                    username: 'caregiver',
                    isVerified: true
                },
                'staff': { 
                    _id: 'mock-staff-id',
                    password: 'staff123', 
                    role: 'staff', 
                    firstName: 'Staff', 
                    lastName: 'User',
                    email: 'staff@lsae.org',
                    username: 'staff',
                    isVerified: true
                }
            };

            const mockUser = mockUsers[username] || Object.values(mockUsers).find(u => u.email === username);
            
            if (mockUser && mockUser.password === password) {
                user = mockUser;
                
                return res.json({
                    success: true,
                    message: 'Login successful',
                    token: 'jwt-token-' + Date.now(),
                    user: {
                        id: user._id,
                        username: user.username,
                        role: user.role,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email
                    }
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }
        }
        
        // Check password for DB user
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        res.json({
            success: true,
            message: 'Login successful',
            token: 'jwt-token-' + Date.now(),
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;
        
        // For demo, auto-verify any OTP
        res.json({
            success: true,
            message: 'OTP verified successfully',
            token: 'jwt-token-' + Date.now()
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during OTP verification',
            error: error.message
        });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Generate reset token
        const resetToken = 'reset-token-' + Date.now();
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
        await user.save();
        
        res.json({
            success: true,
            message: 'Password reset email sent',
            resetToken: resetToken // For demo, return token
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

app.post('/api/auth/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }
        
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password reset successful'
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

app.get('/api/auth/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const user = await User.findOne({
            verificationToken: token,
            verificationExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }
        
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationExpires = undefined;
        await user.save();
        
        res.json({
            success: true,
            message: 'Email verified successfully. You can now login.'
        });
        
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// ==================== DONATION ROUTES ====================

app.post('/api/donations', async (req, res) => {
  try {
    console.log('Donation request received:', req.body);
    
    const { donorName, email, donationType, phone } = req.body;
    
    // These are required for ALL donation types
    if (!donorName || !email || !donationType || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: donorName, email, phone, donationType are required'
      });
    }
    
    // Email validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Phone validation
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 11 digits starting with 09 (e.g., 09123456789)'
      });
    }
    
    // ALL donations now require amount
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }
    
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum < 100) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a number and at least ₱100'
      });
    }
    
    // Prepare donation data
    const donationData = {
      donorName,
      email,
      phone,
      amount: amountNum,
      donationType,
      notes: req.body.notes || '',
      anonymous: req.body.anonymous || false
    };
    
    // Handle different donation types
    switch (donationType) {
      case 'online':
        donationData.paymentMethod = req.body.paymentMethod || null;
        if (!donationData.paymentMethod) {
          return res.status(400).json({
            success: false,
            message: 'Please select a payment method for online donations'
          });
        }
        break;
        
      case 'bank_transfer':
        if (req.body.bankAccount) {
          donationData.bankAccount = req.body.bankAccount;
          
          if (!donationData.bankAccount.bankName || 
              !donationData.bankAccount.accountName || 
              !donationData.bankAccount.accountNumber) {
            return res.status(400).json({
              success: false,
              message: 'Please fill in all bank account details'
            });
          }
        }
        break;
        
      case 'cash':
      case 'check':
        if (!req.body.appointmentDate || !req.body.appointmentTime) {
          return res.status(400).json({
            success: false,
            message: 'Please select appointment date and time for cash/check donations'
          });
        }
        donationData.appointmentDate = req.body.appointmentDate;
        donationData.appointmentTime = req.body.appointmentTime;
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid donation type'
        });
    }
    
    console.log('Donation data to save:', donationData);
    
    const donation = new Donation(donationData);
    await donation.save();
    
    console.log('Donation saved to database:', donation._id);
    console.log('Generated donationId:', donation.donationId);
    
    const checkoutUrl = donationType === 'online' 
      ? `http://localhost:3000/donation/success/${donation._id}`
      : null;
    
    const paymentIntentId = donationType === 'online'
      ? `PI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : null;
    
    if (checkoutUrl) donation.checkoutUrl = checkoutUrl;
    if (paymentIntentId) donation.paymentIntentId = paymentIntentId;
    await donation.save();
    
    res.status(201).json({
      success: true,
      message: 'Donation submitted successfully and saved to database',
      donationId: donation.donationId,
      checkoutUrl: donation.checkoutUrl,
      paymentIntentId: donation.paymentIntentId,
      data: donation
    });
    
  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating donation',
      error: error.message
    });
  }
});

// Get donations
app.get('/api/donations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;
        const status = req.query.status;
        
        let query = {};
        if (status) {
            query.paymentStatus = status;
        }
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            // Return sample data if DB not connected
            return res.json({
                success: true,
                count: 3,
                totalCount: 3,
                data: [
                    {
                        _id: 'sample-1',
                        donorName: 'John Doe',
                        email: 'john@example.com',
                        amount: 5000,
                        donationType: 'online',
                        paymentStatus: 'paid',
                        createdAt: new Date()
                    },
                    {
                        _id: 'sample-2',
                        donorName: 'Maria Santos',
                        email: 'maria@example.com',
                        amount: 3000,
                        donationType: 'bank_transfer',
                        paymentStatus: 'pending',
                        createdAt: new Date()
                    },
                    {
                        _id: 'sample-3',
                        donorName: 'Robert Lim',
                        email: 'robert@example.com',
                        amount: 10000,
                        donationType: 'cash',
                        paymentStatus: 'processing',
                        createdAt: new Date()
                    }
                ]
            });
        }
        
        const donations = await Donation.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalCount = await Donation.countDocuments(query);
        
        res.json({
            success: true,
            count: donations.length,
            totalCount,
            data: donations
        });
        
    } catch (error) {
        console.error('Get donations error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching donations',
            error: error.message
        });
    }
});

// Update donation payment status
app.put('/api/donations/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        
        console.log(`Updating donation ${id} to ${paymentStatus}`);
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database not connected. Cannot update donation.'
            });
        }
        
        const donation = await Donation.findById(id);
        if (!donation) {
            return res.status(404).json({
                success: false,
                message: 'Donation not found'
            });
        }
        
        donation.paymentStatus = paymentStatus;
        
        // Generate receipt number if paid
        if (paymentStatus === 'paid' && !donation.receiptNumber) {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const count = await Donation.countDocuments({
                paymentStatus: 'paid',
                createdAt: {
                    $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                    $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
                }
            });
            donation.receiptNumber = `RCPT-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;
        }
        
        await donation.save();
        
        res.json({
            success: true,
            message: `Donation status updated to ${paymentStatus}`,
            data: donation
        });
        
    } catch (error) {
        console.error('Update donation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating donation',
            error: error.message
        });
    }
});

// ==================== BOOKING ROUTES ====================

app.post('/api/bookings', async (req, res) => {
    try {
        console.log('Booking request received:', req.body);
        
        const { name, email, phone, visitDate, visitTime, purpose, numberOfVisitors, notes } = req.body;
        
        if (!name || !email || !phone || !visitDate || !visitTime || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
        
        const phoneRegex = /^\+?[\d\s-]+$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number'
            });
        }
        
        const visitDateObj = new Date(visitDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (visitDateObj < today) {
            return res.status(400).json({
                success: false,
                message: 'Visit date cannot be in the past'
            });
        }
        
        const bookingData = {
            name,
            email,
            phone,
            visitDate: visitDateObj,
            visitTime,
            purpose,
            numberOfVisitors: numberOfVisitors || 1,
            notes: notes || '',
            status: 'pending'
        };
        
        const booking = new Booking(bookingData);
        await booking.save();
        
        console.log('Booking saved to database:', booking._id);
        
        res.status(201).json({
            success: true,
            message: 'Booking submitted successfully and saved to database',
            bookingId: booking.bookingId,
            data: booking
        });
        
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating booking',
            error: error.message
        });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;
        const status = req.query.status;
        
        let query = {};
        if (status) {
            query.status = status;
        }
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            // Return sample data if DB not connected
            return res.json({
                success: true,
                count: 3,
                totalCount: 3,
                data: [
                    {
                        _id: 'sample-1',
                        name: 'Juan Dela Cruz',
                        email: 'juan@example.com',
                        phone: '09123456789',
                        visitDate: new Date('2024-03-15'),
                        visitTime: '10:00',
                        purpose: 'family_visit',
                        numberOfVisitors: 3,
                        status: 'approved',
                        createdAt: new Date()
                    },
                    {
                        _id: 'sample-2',
                        name: 'Anna Reyes',
                        email: 'anna@example.com',
                        phone: '09123456788',
                        visitDate: new Date('2024-03-16'),
                        visitTime: '14:00',
                        purpose: 'volunteer',
                        numberOfVisitors: 2,
                        status: 'pending',
                        createdAt: new Date()
                    },
                    {
                        _id: 'sample-3',
                        name: 'Pedro Santos',
                        email: 'pedro@example.com',
                        phone: '09123456787',
                        visitDate: new Date('2024-03-17'),
                        visitTime: '11:00',
                        purpose: 'donation',
                        numberOfVisitors: 4,
                        status: 'confirmed',
                        createdAt: new Date()
                    }
                ]
            });
        }
        
        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalCount = await Booking.countDocuments(query);
        
        res.json({
            success: true,
            count: bookings.length,
            totalCount,
            data: bookings
        });
        
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching bookings',
            error: error.message
        });
    }
});

app.put('/api/bookings/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        
        if (!['approved', 'rejected', 'cancelled', 'confirmed', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database not connected. Cannot update booking.'
            });
        }
        
        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        booking.status = status;
        if (status === 'rejected' && rejectionReason) {
            booking.rejectionReason = rejectionReason;
        }
        booking.approvalDate = new Date();
        
        await booking.save();
        
        res.json({
            success: true,
            message: `Booking ${status} successfully`,
            data: booking
        });
        
    } catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating booking',
            error: error.message
        });
    }
});

// ==================== USER MANAGEMENT ====================

// Changed from /api/admin/users to /api/admin/staff to match frontend
app.get('/api/admin/staff', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, staff: [] });
        }
        
        const staff = await User.find({ 
            role: { $in: ['admin', 'nurse', 'caregiver', 'staff', 'doctor', 'therapist'] } 
        }).select('-password').sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: staff.length,
            staff: staff // Frontend expects data.staff
        });
        
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching staff' });
    }
});

// ==================== STATS ROUTE ====================

app.get('/api/stats', async (req, res) => {
    try {
        let stats = {
            totalResidents: 71,
            staffOnDuty: 8,
            pendingAdmissions: 3,
            lowStockItems: 5,
            totalBookings: 0,
            totalDonations: 0,
            pendingBookings: 0,
            completedDonations: 0,
            totalDonationAmount: 0,
            todayMedication: 28
        };
        
        // Try to get real stats if DB is connected
        if (mongoose.connection.readyState === 1) {
            const [totalDonations, pendingBookings, completedDonations, totalBookings] = await Promise.all([
                Donation.countDocuments(),
                Booking.countDocuments({ status: 'pending' }),
                Donation.countDocuments({ paymentStatus: 'paid' }),
                Booking.countDocuments()
            ]);
            
            const donationAmount = await Donation.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            
            stats.totalDonations = totalDonations;
            stats.pendingBookings = pendingBookings;
            stats.completedDonations = completedDonations;
            stats.totalBookings = totalBookings;
            stats.totalDonationAmount = donationAmount[0]?.total || 0;
        }
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching stats',
            error: error.message
        });
    }
});

// ==================== REGISTRATION CODE ROUTES ====================

// Generate Staff ID
function generateStaffId() {
    const prefix = 'LSAE';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    return `${prefix}-${year}${month}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Generate Registration Codes
app.post('/api/admin/generate-codes', async (req, res) => {
    try {
        const { count = 1, role = 'staff' } = req.body;
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database not connected. Cannot generate codes.'
            });
        }
        
        const codes = [];
        
        for (let i = 0; i < count; i++) {
            const code = `LSAE-REG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
            
            const registrationCode = new RegistrationCode({
                code,
                role,
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
            });
            
            await registrationCode.save();
            codes.push({
                code: registrationCode.code,
                role: registrationCode.role,
                expiresAt: registrationCode.expiresAt
            });
        }
        
        res.json({
            success: true,
            message: `Generated ${count} registration code(s)`,
            codes
        });
        
    } catch (error) {
        console.error('Generate codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating codes'
        });
    }
});

// Get registration codes
app.get('/api/admin/registration-codes', async (req, res) => {
    try {
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: true,
                count: 2,
                codes: [
                    {
                        code: 'LSAE-REG-STAFF123',
                        role: 'staff',
                        generatedAt: new Date(),
                        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                        status: 'active'
                    },
                    {
                        code: 'LSAE-REG-NURSE456',
                        role: 'nurse',
                        generatedAt: new Date(),
                        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                        status: 'active'
                    }
                ]
            });
        }
        
        const codes = await RegistrationCode.find({
            status: 'active',
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: codes.length,
            codes: codes.map(code => ({
                code: code.code,
                role: code.role,
                generatedAt: code.generatedAt,
                expiresAt: code.expiresAt,
                status: code.status
            }))
        });
        
    } catch (error) {
        console.error('Get codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching codes'
        });
    }
});

// Validate registration code
app.post('/api/auth/validate-code', async (req, res) => {
    try {
        const { registrationCode } = req.body;
        
        if (!registrationCode) {
            return res.status(400).json({
                success: false,
                valid: false,
                message: 'Registration code is required'
            });
        }
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            // For demo purposes, accept any code that matches pattern
            if (registrationCode.toUpperCase().startsWith('LSAE-REG-')) {
                return res.json({
                    success: true,
                    valid: true,
                    generatedId: generateStaffId(),
                    role: 'staff',
                    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
                });
            } else {
                return res.status(400).json({
                    success: false,
                    valid: false,
                    message: 'Invalid registration code format'
                });
            }
        }
        
        const codeDoc = await RegistrationCode.findOne({
            code: registrationCode.toUpperCase(),
            status: 'active',
            expiresAt: { $gt: new Date() }
        });
        
        if (!codeDoc) {
            return res.status(400).json({
                success: false,
                valid: false,
                message: 'Invalid, expired, or already used registration code'
            });
        }
        
        res.json({
            success: true,
            valid: true,
            generatedId: generateStaffId(),
            role: codeDoc.role,
            expiresAt: codeDoc.expiresAt
        });
        
    } catch (error) {
        console.error('Validate code error:', error);
        res.status(500).json({
            success: false,
            valid: false,
            message: 'Error validating code'
        });
    }
});

// ==================== STAFF REGISTRATION ====================

app.post('/api/auth/register-staff', async (req, res) => {
    try {
        const {
            registrationCode,
            username,
            email,
            password,
            firstName,
            lastName,
            phone,
            shift = 'morning',
            ward = '',
            employeeType = 'permanent',
            hireDate = new Date()
        } = req.body;
        
        console.log('Staff registration attempt:', { email, username });
        
        // Validate required fields
        if (!registrationCode || !username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database not connected. Please try again later.'
            });
        }
        
        // Validate registration code
        const codeDoc = await RegistrationCode.findOne({
            code: registrationCode.toUpperCase(),
            status: 'active',
            expiresAt: { $gt: new Date() }
        });
        
        if (!codeDoc) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired registration code'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email or username already exists'
            });
        }
        
        // Create user
        const user = new User({
            username,
            email,
            password,
            firstName,
            lastName,
            phone,
            role: codeDoc.role,
            shift,
            ward,
            employeeType,
            hireDate: new Date(hireDate),
            isVerified: false, 
            isActive: false    
        });
        
        await user.save();
        
        // Mark registration code as used
        codeDoc.status = 'used';
        codeDoc.usedBy = user._id;
        codeDoc.usedAt = new Date();
        await codeDoc.save();
        
        console.log('✅ Staff registered successfully:', user.email);
        
        res.status(201).json({
            success: true,
            message: 'Staff registered successfully',
            // Send these directly so the AdminDashboard can find them
            userId: user._id, 
            email: user.email,
            firstName: user.firstName,
            staffId: user.staffId || user._id, // Add this for the alert message
            data: {
                userId: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Staff registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
});

// ==================== SEED ENDPOINT ====================

app.post('/api/seed', async (req, res) => {
    try {
        console.log('Seeding database with sample data...');
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database not connected. Cannot seed data.'
            });
        }
        
        // Clear existing data
        await Donation.deleteMany({});
        await Booking.deleteMany({});
        await RegistrationCode.deleteMany({});
        
        // Create sample donations
        const sampleDonations = [
            {
                donorName: 'John Doe',
                email: 'john@example.com',
                phone: '09123456789',
                amount: 5000,
                donationType: 'online',
                paymentMethod: 'gcash',
                paymentStatus: 'paid',
                notes: 'For medical supplies'
            },
            {
                donorName: 'Maria Santos',
                email: 'maria@example.com',
                phone: '09123456788',
                amount: 3000,
                donationType: 'bank_transfer',
                paymentStatus: 'pending',
                notes: 'General fund'
            },
            {
                donorName: 'Robert Johnson',
                email: 'robert@example.com',
                phone: '09123456787',
                amount: 10000,
                donationType: 'cash',
                paymentStatus: 'processing',
                notes: 'For facility improvement'
            }
        ];
        
        const createdDonations = await Donation.insertMany(sampleDonations);
        
        // Create sample bookings
        const sampleBookings = [
            {
                name: 'Juan Dela Cruz',
                email: 'juan@example.com',
                phone: '09123456789',
                visitDate: new Date('2024-03-20'),
                visitTime: '10:00',
                purpose: 'tour',
                numberOfVisitors: 2,
                status: 'approved',
                notes: 'Family visit'
            },
            {
                name: 'Maria Santos',
                email: 'maria@example.com',
                phone: '09123456788',
                visitDate: new Date('2024-03-22'),
                visitTime: '14:00',
                purpose: 'volunteer',
                numberOfVisitors: 1,
                status: 'pending',
                notes: 'Want to volunteer on weekends'
            },
            {
                name: 'Pedro Reyes',
                email: 'pedro@example.com',
                phone: '09123456787',
                visitDate: new Date('2024-03-25'),
                visitTime: '11:00',
                purpose: 'donation',
                numberOfVisitors: 3,
                status: 'confirmed',
                notes: 'Bringing donations'
            }
        ];
        
        const createdBookings = await Booking.insertMany(sampleBookings);
        
        // Create registration codes
        const sampleCodes = [
            {
                code: 'LSAE-REG-ADMIN123',
                role: 'admin',
                status: 'active'
            },
            {
                code: 'LSAE-REG-NURSE456',
                role: 'nurse',
                status: 'active'
            },
            {
                code: 'LSAE-REG-STAFF789',
                role: 'staff',
                status: 'active'
            }
        ];
        
        const createdCodes = await RegistrationCode.insertMany(sampleCodes);
        
        res.json({
            success: true,
            message: 'Database seeded with sample data',
            counts: {
                donations: createdDonations.length,
                bookings: createdBookings.length,
                codes: createdCodes.length
            }
        });
        
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error seeding data',
            error: error.message
        });
    }
});

// ==================== RESEND OTP ====================

app.post('/api/auth/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: true,
                message: 'OTP resent successfully (demo)',
                otp: '123456' // Demo OTP
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await user.save();
        
        console.log(`OTP for ${user.email}: ${otp}`); // For development
        
        res.json({
            success: true,
            message: 'OTP resent successfully',
            otp: otp // For testing only
        });
        
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(` API Base URL: http://localhost:${PORT}`);
    console.log(` Health Check: http://localhost:${PORT}/api/health`);
    console.log(`⚡ Database status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
});
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust path as needed

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Capstone_DB:INF233@cluster0.4zhzwkr.mongodb.net/kanang-alalay?retryWrites=true&w=majority';

async function seedAdmin() {
    try {
        console.log('⏳ Connecting to Database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas!');

        // Update or create the Master Admin account
        const existingAdmin = await User.findOne({ username: 'admin' });
        
        if (existingAdmin) {
            console.log('📝 Updating existing admin account...');
            
            existingAdmin.staffId = existingAdmin.staffId || 'LSAE-ADMIN-0001';
            existingAdmin.email = 'admin@kanangalalay.org';
            existingAdmin.password = 'admin123';
            existingAdmin.firstName = 'Sandra';
            existingAdmin.lastName = 'Da Silva';
            existingAdmin.role = 'admin';
            existingAdmin.isActive = true;
            existingAdmin.isVerified = true;
            
            // 🔥 CRITICAL: These flags prevent OTP verification
            existingAdmin.isFirstLogin = false;
            existingAdmin.needsProfileUpdate = false;
            existingAdmin.status = 'active';
            
            // Clear any OTP-related fields
            existingAdmin.verificationOtp = undefined;
            existingAdmin.verificationOtpExpires = undefined;
            existingAdmin.otpCode = undefined;
            existingAdmin.otpExpires = undefined;
            
            await existingAdmin.save();
            console.log('✅ Admin account updated successfully!');
        } else {
            console.log('📝 Creating new admin account...');
            
            const adminUser = new User({
                staffId: 'LSAE-ADMIN-0001',
                username: 'admin',
                email: 'admin@kanangalalay.org',
                password: 'admin123',
                firstName: 'Sandra',
                lastName: 'Da Silva',
                role: 'admin',
                isActive: true,
                isVerified: true,
                isFirstLogin: false,      // ← Prevents OTP requirement
                needsProfileUpdate: false, // ← No profile update needed
                status: 'active'
            });
            
            await adminUser.save();
            console.log('✅ Admin account created successfully!');
        }
        
        // Verify the admin was created correctly
        const verifyAdmin = await User.findOne({ username: 'admin' }).select('+password');
        console.log('\n🎉 SUCCESS! Admin account ready.');
        console.log('-----------------------------------');
        console.log('👤 Username: admin');
        console.log('🔑 Password: admin123');
        console.log('📧 Email: admin@kanangalalay.org');
        console.log('✅ isFirstLogin:', verifyAdmin.isFirstLogin);
        console.log('✅ status:', verifyAdmin.status);
        console.log('-----------------------------------');
        console.log('\n🔐 You can now login directly without OTP verification!');

    } catch (error) {
        console.error('❌ Error creating admin:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seedAdmin();
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User'); 

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Capstone_DB:INF233@cluster0.4zhzwkr.mongodb.net/kanang-alalay?retryWrites=true&w=majority';

async function seedAdmin() {
    try {
        console.log('⏳ Connecting to Database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas!');

        // Create the Master Admin account
        const adminUser = new User({
            username: 'admin',
            email: 'admin@kanangalalay.org',
            password: 'admin123', 
            firstName: 'Master',
            lastName: 'Admin',
            role: 'admin',
            isActive: true,       
            isVerified: true      
        });

        await adminUser.save();
        
        console.log('🎉 SUCCESS! Master Admin account recreated.');
        console.log('-----------------------------------');
        console.log('👤 Username: admin');
        console.log('🔑 Password: admin123');
        console.log('-----------------------------------');

    } catch (error) {
        console.error('❌ Error creating admin:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seedAdmin();
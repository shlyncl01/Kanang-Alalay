#!/usr/bin/env node
/**
 * Migration Script: Update shifts from 3-shift (Morning/Afternoon/Night) 
 * to new 12-hour system (Day 7-7 / Night 7-7 / Flexible)
 * 
 * Usage: node scripts/migrateShifts.js
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Maps old shifts to new shifts
 * 3. Ensures Admins always get FLEXIBLE
 * 4. Updates all User records
 * 5. Generates a report
 * 6. Disconnects
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

// Shift mappings
const SHIFT_MAP = {
    'morning': 'DAY',      
    'afternoon': 'NIGHT',
    'night': 'NIGHT',      
    'flexible': 'FLEXIBLE',
    'rotating': 'DAY',
};

const SHIFT_TIMES = {
    'DAY': { start: '07:00', end: '19:00' },
    'NIGHT': { start: '19:00', end: '07:00' },
    'FLEXIBLE': { start: null, end: null }
};

const migrateShifts = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all users
        console.log('📊 Fetching all staff members...');
        const allUsers = await User.find({});
        console.log(`✅ Found ${allUsers.length} staff members\n`);

        if (allUsers.length === 0) {
            console.log('ℹ️  No staff members to migrate.');
            await mongoose.disconnect();
            return;
        }

        // Migration report
        const report = {
            total: allUsers.length,
            migrated: 0,
            byRole: { admin: 0, head_caregiver: 0, caregiver: 0 },
            byShift: { DAY: 0, NIGHT: 0, FLEXIBLE: 0 },
            errors: []
        };

        console.log('🔄 Migrating shifts...\n');

        for (const user of allUsers) {
            const oldShift = user.shift;
            let newShift;

            try {
                // Override: All admins MUST be Flexible
                if (user.role === 'admin') {
                    newShift = 'FLEXIBLE';
                } else {
                    // Map old shift to new shift. A non-admin whose old
                    // value was literally 'flexible' would map to FLEXIBLE
                    // here, which the User model rejects (only Admins can be
                    // FLEXIBLE) — fall back to DAY for non-admins instead.
                    newShift = SHIFT_MAP[oldShift] || 'DAY';
                    if (newShift === 'FLEXIBLE') newShift = 'DAY';
                }

                // Set shift times
                const times = SHIFT_TIMES[newShift];
                user.shift = newShift;
                user.shiftStartTime = times.start;
                user.shiftEndTime = times.end;

                // Save the updated user
                await user.save();

                // Update report
                report.migrated++;
                report.byRole[user.role]++;
                report.byShift[newShift]++;

                const arrow = oldShift !== newShift ? '→' : '=';
                console.log(
                    `  ✓ ${user.firstName.padEnd(12)} ${user.lastName.padEnd(12)} | ` +
                    `${user.role.padEnd(15)} | ${String(oldShift).padEnd(10)} ${arrow} ${newShift.padEnd(9)} | ${times.start || 'N/A'}-${times.end || 'N/A'}`
                );
            } catch (error) {
                report.errors.push({
                    staffId: user.staffId,
                    name: `${user.firstName} ${user.lastName}`,
                    error: error.message
                });
                console.error(
                    `  ✗ ${user.firstName.padEnd(12)} ${user.lastName.padEnd(12)} | Error: ${error.message}`
                );
            }
        }

        // Print report
        console.log('\n' + '═'.repeat(80));
        console.log('📋 MIGRATION REPORT');
        console.log('═'.repeat(80));
        console.log(`✅ Successfully migrated: ${report.migrated}/${report.total}`);
        console.log(`\n  By Role:`);
        console.log(`    • Admin:          ${report.byRole.admin}`);
        console.log(`    • Head Caregiver: ${report.byRole.head_caregiver}`);
        console.log(`    • Caregiver:      ${report.byRole.caregiver}`);
        console.log(`\n  By New Shift:`);
        console.log(`    • Day Shift:      ${report.byShift.DAY} (7:00 AM – 7:00 PM)`);
        console.log(`    • Night Shift:    ${report.byShift.NIGHT} (7:00 PM – 7:00 AM)`);
        console.log(`    • Flexible:       ${report.byShift.FLEXIBLE} (Variable hours)`);

        if (report.errors.length > 0) {
            console.log(`\n⚠️  Errors (${report.errors.length}):`);
            report.errors.forEach(err => {
                console.log(`    • ${err.name} (${err.staffId}): ${err.error}`);
            });
        }

        console.log('\n' + '═'.repeat(80));
        console.log('✅ Migration completed successfully!');
        console.log('═'.repeat(80));

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
};

// Run migration
migrateShifts();

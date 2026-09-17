const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  targetId: { type: mongoose.Schema.Types.ObjectId },

  role: { type: String, enum: ['admin', 'head_caregiver', 'caregiver', null], default: null },
  module: {
    type: String,
    enum: [
      'User Management',
      'Staff Roster',
      'Residents',
      'Medication',
      'Inventory',
      'Donations',
      'Bookings',
      'Login/Account Security',
      'Other',
    ],
    default: 'Other',
  },
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  targetLabel: { type: String, default: '' },
  targetModel: { type: String, default: '' },
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ module: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
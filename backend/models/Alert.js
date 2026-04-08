const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["OTP", "Booking", "Inventory", "System"],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  details: { type: Object }, 
  isRead: { type: Boolean, default: false },
  relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("Alert", alertSchema);
const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  targetId: { type: mongoose.Schema.Types.ObjectId } 
}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
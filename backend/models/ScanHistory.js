const mongoose = require('mongoose');

const scanHistorySchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: true,
    },
    medication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    residents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resident',
      },
    ],
    source: {
      type: String,
      default: 'database',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending'
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScanHistory', scanHistorySchema);

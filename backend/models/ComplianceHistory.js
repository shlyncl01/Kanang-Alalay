const mongoose = require('mongoose');

/**
 * models/ComplianceHistory.js
 *
 * PART 10 — HEAD CAREGIVER MEDICATION COMPLIANCE HISTORY
 *
 * One document = one Head Caregiver's medication-compliance snapshot for
 * one calendar day (Manila time). This is what makes yesterday's
 * compliance number survive into today — previously GET /stats computed
 * complianceRate live from MedicationLog for "today" only, and that number
 * was never written anywhere, so it was gone the moment the day rolled
 * over.
 *
 * This collection does NOT duplicate or replace MedicationLog as a source
 * of truth. scheduled/completed/etc. below are always derived FROM
 * MedicationLog at write time (see the upsert in routes/headCaregiverRoutes.js
 * GET /stats) — this table only stores the resulting daily totals so they
 * remain queryable after "today" becomes "yesterday".
 *
 * Written by: routes/headCaregiverRoutes.js GET /stats (upserted on every
 * load of the Head Caregiver dashboard for the current Manila day — so the
 * row for "today" keeps getting refreshed with the latest counts, and
 * becomes a permanent frozen record once the day changes and a new row
 * starts being written instead).
 *
 * Read by: routes/headCaregiverRoutes.js GET /compliance-history, always
 * filtered by headCaregiverId === req.user._id, so one Head Caregiver can
 * never see another Head Caregiver's history.
 */
const complianceHistorySchema = new mongoose.Schema(
  {
    headCaregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Start-of-day (Manila) timestamp this record covers — the same value
    // GET /stats uses as `today` (see utils/dateHelpers.js startOfManilaDay).
    // Paired with headCaregiverId below to give exactly one row per HC per
    // calendar day.
    date: {
      type: Date,
      required: true,
    },

    // Snapshot of the same numbers the dashboard stat cards show for that
    // day — mirrors the fields GET /stats already returns.
    scheduled: { type: Number, default: 0 }, // `total` on the dashboard
    completed: { type: Number, default: 0 }, // `onTime`
    delayed:   { type: Number, default: 0 },
    missed:    { type: Number, default: 0 },
    pending:   { type: Number, default: 0 },

    // 0–100, same rounding rule as the live calculation:
    // Math.round((completed / scheduled) * 100), or 0 when scheduled is 0.
    complianceRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One row per (Head Caregiver, day). GET /stats upserts this on every
// call for the current day rather than inserting duplicates.
complianceHistorySchema.index({ headCaregiverId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceHistory', complianceHistorySchema);
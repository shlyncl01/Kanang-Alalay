const express = require('express');
const router = express.Router();
const Resident = require('../models/Resident');
const MedicationLog = require('../models/MedicationLog');
const { protect } = require('../middleware/authMiddleware');

const getUserFullName = (user = {}) =>
  `${user.firstName || ''} ${user.lastName || ''}`.trim();

const assignedResidentQuery = (user) => {
  if (['admin', 'head_caregiver'].includes(user.role)) {
    return { status: 'active' };
  }

  const userName = getUserFullName(user);
  return {
    status: 'active',
    $or: [
      { primaryCaregiverId: user._id },
      { primaryCaregiverName: userName },
      { primaryCaregiver: userName },
      { assignedCaregiver: userName },
      { assignedNurse: userName },
      { 'assignedStaff.primaryCaregiverId': user._id },
      { 'assignedStaff.primaryCaregiverName': userName },
      { 'assignedStaff.primaryCaregiver': userName },
      { 'assignedStaff.assignedCaregiver': userName },
      { 'assignedStaff.assignedNurse': userName },
    ],
  };
};

const formatTime = (date) => {
  if (!date) return 'No time';
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });
};

const residentName = (resident) =>
  resident.fullName || `${resident.firstName || ''} ${resident.lastName || ''}`.trim();

router.get('/my-assigned', protect, async (req, res) => {
  try {
    const residents = await Resident.find(assignedResidentQuery(req.user)).sort({ roomNumber: 1 });
    const residentIds = residents.map((resident) => resident._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logQuery = {
      residentId: { $in: residentIds },
      scheduledTime: { $gte: today, $lt: tomorrow },
      // 'scheduled' means the head caregiver hasn't prepared it yet — only show
      // once it's been prepared ('pending') or has become overdue.
      status: { $in: ['pending', 'overdue'] },
    };

    const logs = await MedicationLog.find(logQuery)
      .populate('medicationId', 'name dosage form')
      .sort({ scheduledTime: 1 });

    const logsByResident = logs.reduce((acc, log) => {
      const key = String(log.residentId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});

    const schedules = residents
      .map((resident) => {
        const embeddedMeds = (resident.medications || []).map((med) => ({
          _id: med._id,
          name: med.name,
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          scheduleTime: med.scheduleTime || 'No time',
          status: med.status || 'active',
          source: 'resident',
        }));

        const scheduledMeds = (logsByResident[String(resident._id)] || []).map((log) => ({
          _id: log._id,
          logId: log._id,
          medicationId: log.medicationId?._id,
          name: log.medicationName || log.medicationId?.name || 'Medication',
          dosage: log.dosage || '',
          frequency: log.frequency || '',
          scheduleTime: formatTime(log.scheduledTime),
          scheduledTime: log.scheduledTime,
          status: log.status || 'scheduled',
          source: 'schedule',
        }));

        return {
          _id: resident._id,
          residentName: residentName(resident),
          room: resident.room || resident.roomNumber,
          bed: resident.bed,
          age: resident.age,
          conditions: resident.conditions || [],
          allergies: resident.allergies || '',
          assignedCaregiver: resident.assignedCaregiver || resident.primaryCaregiverName || '',
          medications: [...scheduledMeds, ...embeddedMeds],
        };
      })
      .filter((item) => item.medications.length > 0);

    res.json({ success: true, schedules });
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedule' });
  }
});

module.exports = router;

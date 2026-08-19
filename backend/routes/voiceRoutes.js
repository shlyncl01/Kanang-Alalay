const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const { processVoice, transcribeAudio } = require('../services/OpenAIService');
const Resident = require('../models/Resident');
const MedicationLog = require('../models/MedicationLog');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// Matches the same "caregivers only see their own residents" scoping used by
// GET /api/residents/assigned, then finds the best name match among those
// candidates — spoken/typed names won't line up with a database ID, and no
// name-lookup existed anywhere in the backend before this.
const findResidentByName = async (name, user) => {
  if (!name) return null;
  const isOverseer = ['admin', 'head_caregiver'].includes(user.role);
  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const query = isOverseer
    ? { status: 'active' }
    : {
        status: 'active',
        $or: [
          { primaryCaregiverId: user._id },
          { primaryCaregiverName: userName },
          { primaryCaregiver: userName },
          { assignedNurse: userName },
          { assignedCaregiver: userName },
          { 'assignedStaff.primaryCaregiverId': user._id },
          { 'assignedStaff.primaryCaregiverName': userName },
          { 'assignedStaff.primaryCaregiver': userName },
          { 'assignedStaff.assignedNurse': userName },
          { 'assignedStaff.assignedCaregiver': userName },
        ],
      };

  const residents = await Resident.find(query);
  const q = name.toLowerCase().trim();

  return (
    residents.find((r) => {
      const full = [r.firstName, r.middleName, r.lastName, r.nickname].filter(Boolean).join(' ').toLowerCase();
      return full === q || full.includes(q) || q.includes(full);
    }) ||
    // Fallback: a spoken/typed name won't always line up word-for-word with
    // firstName + middleName + lastName concatenated in that exact order, so
    // this just checks the first and last name both appear somewhere in it.
    residents.find((r) => {
      const first = (r.firstName || '').toLowerCase();
      const last = (r.lastName || '').toLowerCase();
      return first && last && q.includes(first) && q.includes(last);
    }) ||
    null
  );
};

router.post('/transcribe', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file provided.' });
    }

    const transcription = await transcribeAudio(req.file.path);
    await fs.promises.unlink(req.file.path).catch(() => {});

    res.json({ success: true, data: { text: transcription } });
  } catch (error) {
    console.error('Transcription error:', error);
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/respond', protect, async (req, res) => {
  try {
    const { message, language } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const parsed = await processVoice(message, language);

    // "show" intent asks to look up a resident's info — processVoice only
    // does NLU (intent + name extraction), it has no DB access, so this is
    // where the extracted patient name actually gets resolved against real
    // data and the response is rebuilt from it instead of the model's guess.
    if (parsed.intent === 'show' && parsed.patient) {
      const resident = await findResidentByName(parsed.patient, req.user);

      if (!resident) {
        parsed.response = language === 'Tagalog'
          ? `Hindi ko mahanap si "${parsed.patient}" sa mga residenteng nakatalaga sa iyo.`
          : `I couldn't find a resident named "${parsed.patient}" among your assigned residents.`;
      } else {
        const residentName = resident.fullName || `${resident.firstName} ${resident.lastName}`.trim();
        const room = resident.room || resident.roomNumber
          || (language === 'Tagalog' ? 'walang nakatalagang kuwarto' : 'no assigned room');
        const floor = resident.floor || (language === 'Tagalog' ? 'hindi tiyak' : 'not on file');
        const bed = resident.bed || (language === 'Tagalog' ? 'hindi tiyak' : 'not on file');
        const location = `${room}, ${floor}, Bed ${bed}`;
        const conditionNames = (resident.medicalConditions || []).map((c) => c.name).filter(Boolean);
        const conditions = conditionNames.length > 0
          ? conditionNames.join(', ')
          : (resident.conditions || []).join(', ')
            || (language === 'Tagalog' ? 'walang nakatalang kondisyon' : 'no conditions on file');

        const logs = await MedicationLog.find({
          residentId: resident._id,
          status: { $in: ['pending', 'overdue'] },
        }).sort({ scheduledTime: 1 });

        const formatTime = (log) => log.scheduledTime
          ? new Date(log.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })
          : (log.nextDose || (language === 'Tagalog' ? 'hindi naka-iskedyul' : 'not scheduled'));

        parsed.room = room;
        parsed.floor = floor;
        parsed.bed = bed;
        parsed.symptom = conditions;

        if (logs.length === 0) {
          parsed.medication = null;
          parsed.dosage = null;
          parsed.time = null;
          parsed.response = language === 'Tagalog'
            ? `Si ${residentName} ay nasa ${location}. Walang kasalukuyang iskedyul ng gamot. Kilalang kondisyon: ${conditions}.`
            : `${residentName} is in ${location}. No current medication is due. Known conditions: ${conditions}.`;
        } else {
          parsed.medication = logs.map((l) => l.medicationName).join(', ');
          parsed.dosage = logs.map((l) => l.dosage).join(', ');
          parsed.time = logs.map(formatTime).join(', ');

          const medList = logs.map((l) => `${l.medicationName} (${l.dosage}) at ${formatTime(l)}`).join(', ');
          parsed.response = language === 'Tagalog'
            ? `Si ${residentName} ay nasa ${location}. Kasalukuyang gamot: ${medList}. Kilalang kondisyon: ${conditions}.`
            : `${residentName} is in ${location}. Current medication: ${medList}. Known conditions: ${conditions}.`;
        }
      }
    }

    // "administer" (please give this now) and "confirm" (I already gave it)
    // both end in the same real action — marking a dose administered — so
    // both go through the same lookup here. Neither writes anything yet:
    // this only finds the matching scheduled dose and asks the caregiver to
    // say "confirm" before anything is actually recorded. The mobile app
    // auto-opens the mic right after speaking this question, listens for the
    // spoken confirm/cancel, and calls the existing
    // POST /medications/administer/:logId route itself if confirmed — this
    // route only ever describes the pending dose, it never marks it given.
    if ((parsed.intent === 'administer' || parsed.intent === 'confirm') && parsed.patient) {
      const resident = await findResidentByName(parsed.patient, req.user);

      if (!resident) {
        parsed.response = language === 'Tagalog'
          ? `Hindi ko mahanap si "${parsed.patient}" sa mga residenteng nakatalaga sa iyo.`
          : `I couldn't find a resident named "${parsed.patient}" among your assigned residents.`;
      } else {
        const residentName = resident.fullName || `${resident.firstName} ${resident.lastName}`.trim();

        let logs = await MedicationLog.find({
          residentId: resident._id,
          status: { $in: ['pending', 'overdue'] },
        }).sort({ scheduledTime: 1 });

        if (parsed.medication) {
          const medQuery = parsed.medication.toLowerCase();
          const filtered = logs.filter((l) => (l.medicationName || '').toLowerCase().includes(medQuery));
          if (filtered.length > 0) logs = filtered;
        }

        const log = logs[0];

        if (!log) {
          parsed.response = language === 'Tagalog'
            ? `Walang kasalukuyang gamot na hinihintay para kay ${residentName}.`
            : `There's no medication currently due for ${residentName}.`;
        } else {
          const timeStr = log.scheduledTime
            ? new Date(log.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })
            : (log.nextDose || (language === 'Tagalog' ? 'hindi naka-iskedyul' : 'not scheduled'));

          parsed.medication = log.medicationName;
          parsed.dosage = log.dosage;
          parsed.time = timeStr;
          parsed.pendingLogId = String(log._id);
          parsed.response = language === 'Tagalog'
            ? `Nakita ko: ${log.medicationName} (${log.dosage}) para kay ${residentName}, naka-iskedyul ${timeStr}. Sabihin ang "confirm" para itala bilang naibigay.`
            : `Found ${log.medicationName} (${log.dosage}) for ${residentName}, scheduled ${timeStr}. Say "confirm" to mark it as administered.`;
        }
      }
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Respond error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

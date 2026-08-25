const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const { processVoice, transcribeAudio } = require('../services/OpenAIService');
const Resident = require('../models/Resident');
const MedicationLog = require('../models/MedicationLog');
const { getManilaDayBounds } = require('../utils/dateHelpers');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// Matches the same "caregivers only see their own residents" scoping used by
// GET /api/residents/assigned.
const getAssignedScopeQuery = (user) => {
  const isOverseer = ['admin', 'head_caregiver'].includes(user.role);
  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return isOverseer
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
};

// Finds the best name match among the caregiver's own residents —
// spoken/typed names won't line up with a database ID, and no name-lookup
// existed anywhere in the backend before this.
const findResidentByName = async (name, user) => {
  if (!name) return null;
  const residents = await Resident.find(getAssignedScopeQuery(user));
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

const formatLogTime = (log, language) => log.scheduledTime
  ? new Date(log.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })
  : (log.nextDose || (language === 'Tagalog' ? 'hindi naka-iskedyul' : 'not scheduled'));

router.post('/respond', protect, async (req, res) => {
  try {
    const { message, language, history } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const parsed = await processVoice(message, language, history);

    // "show" intent asks to look up a resident's info — processVoice only
    // does NLU (intent + name extraction), it has no DB access, so this is
    // where the extracted patient name actually gets resolved against real
    // data and the response is rebuilt from it instead of the model's guess.
    // A message with no patient name means "show me everyone" instead of one
    // resident — handled as a separate, all-residents summary below.
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
        const age = resident.age != null ? String(resident.age) : (language === 'Tagalog' ? 'hindi tiyak' : 'not on file');
        const allergies = resident.allergies || (language === 'Tagalog' ? 'wala sa file' : 'none on file');
        const v = resident.latestVitals || {};
        const hasVitals = v.bloodPressure || v.heartRate != null || v.temperature != null || v.oxygenSat != null;
        const vitals = hasVitals
          ? `BP ${v.bloodPressure || '—'}, HR ${v.heartRate ?? '—'}, Temp ${v.temperature ?? '—'}, O2 ${v.oxygenSat ?? '—'}`
          : (language === 'Tagalog' ? 'walang naitalang vitals' : 'no vitals on file');

        // Full picture for today, not just what's still actionable — every
        // status except 'scheduled' (the head caregiver hasn't prepared that
        // one yet, so a caregiver shouldn't see it via voice either), plus
        // any still-unresolved backlog from before today.
        const { today, tomorrow } = getManilaDayBounds();
        const [logsToday, logsBacklog] = await Promise.all([
          MedicationLog.find({
            residentId: resident._id,
            scheduledTime: { $gte: today, $lt: tomorrow },
            status: { $in: ['pending', 'overdue', 'administered', 'completed'] },
          }).sort({ scheduledTime: 1 }),
          MedicationLog.find({
            residentId: resident._id,
            scheduledTime: { $lt: today },
            status: { $in: ['pending', 'overdue'] },
          }).sort({ scheduledTime: 1 }),
        ]);
        const logs = [...logsBacklog, ...logsToday];

        const STATUS_LABEL = language === 'Tagalog'
          ? { pending: 'hinihintay', overdue: 'huli na', administered: 'naibigay na', completed: 'naibigay na' }
          : { pending: 'waiting', overdue: 'overdue', administered: 'given', completed: 'given' };
        const describeLog = (l) => `${l.medicationName} (${l.dosage}) at ${formatLogTime(l, language)} — ${STATUS_LABEL[l.status] || l.status}`;

        parsed.room = room;
        parsed.floor = floor;
        parsed.bed = bed;
        parsed.symptom = conditions;

        const profileLine = language === 'Tagalog'
          ? `Si ${residentName} ay nasa ${location}. Edad: ${age}. Allergy: ${allergies}. Kilalang kondisyon: ${conditions}. Huling vitals: ${vitals}.`
          : `${residentName} is in ${location}. Age: ${age}. Allergies: ${allergies}. Known conditions: ${conditions}. Latest vitals: ${vitals}.`;

        if (logs.length === 0) {
          parsed.medication = null;
          parsed.dosage = null;
          parsed.time = null;
          parsed.response = `${profileLine} ` + (language === 'Tagalog'
            ? 'Walang naka-iskedyul na gamot ngayong araw.'
            : 'No medication is scheduled for today.');
        } else {
          parsed.medication = logs.map((l) => l.medicationName).join(', ');
          parsed.dosage = logs.map((l) => l.dosage).join(', ');
          parsed.time = logs.map((l) => formatLogTime(l, language)).join(', ');

          const medList = logs.map(describeLog).join('; ');
          parsed.response = `${profileLine} ` + (language === 'Tagalog'
            ? `Ngayong araw: ${medList}.`
            : `Today: ${medList}.`);
        }
      }
    }

    // "show" with no patient name — the caregiver's full schedule across all
    // their residents. The spoken reply stays short (a count summary) since
    // reading every dose for every resident aloud is tedious to listen to,
    // but the full breakdown (with names) still goes in `response` — it's
    // what's shown in chat AND what's replayed back as conversation history,
    // so a follow-up like "which ones were late?" can still be answered from
    // it even though it was never actually spoken aloud.
    if (parsed.intent === 'show' && !parsed.patient) {
      const residents = await Resident.find(getAssignedScopeQuery(req.user));
      const nameById = new Map(residents.map((r) => [String(r._id), r.fullName || `${r.firstName} ${r.lastName}`.trim()]));

      const { today, tomorrow } = getManilaDayBounds();
      const logs = await MedicationLog.find({
        residentId: { $in: residents.map((r) => r._id) },
        scheduledTime: { $gte: today, $lt: tomorrow },
        status: { $in: ['pending', 'overdue', 'administered', 'completed'] },
      }).sort({ scheduledTime: 1 });

      const given = logs.filter((l) => ['administered', 'completed'].includes(l.status));
      const waiting = logs.filter((l) => l.status === 'pending');
      const overdue = logs.filter((l) => l.status === 'overdue');
      const describe = (l) => `${nameById.get(String(l.residentId)) || l.residentName} — ${l.medicationName} (${l.dosage}) at ${formatLogTime(l, language)}`;

      if (language === 'Tagalog') {
        const parts = [
          given.length ? `Naibigay na: ${given.map(describe).join('; ')}.` : '',
          waiting.length ? `Hinihintay: ${waiting.map(describe).join('; ')}.` : '',
          overdue.length ? `Huli na: ${overdue.map(describe).join('; ')}.` : '',
        ].filter(Boolean).join(' ');
        parsed.response = parts || 'Walang naka-iskedyul na gamot ngayong araw para sa iyong mga residente.';
        parsed.speech = `May ${logs.length} gamot ngayong araw: ${given.length} naibigay na, ${waiting.length} hinihintay, ${overdue.length} huli na.`;
      } else {
        const parts = [
          given.length ? `Given: ${given.map(describe).join('; ')}.` : '',
          waiting.length ? `Waiting: ${waiting.map(describe).join('; ')}.` : '',
          overdue.length ? `Overdue: ${overdue.map(describe).join('; ')}.` : '',
        ].filter(Boolean).join(' ');
        parsed.response = parts || 'No medications are scheduled today for your residents.';
        parsed.speech = `You have ${logs.length} doses today: ${given.length} given, ${waiting.length} waiting, ${overdue.length} overdue.`;
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
          const timeStr = formatLogTime(log, language);

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

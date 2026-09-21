const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Only the last MAX_HISTORY_TURNS messages are kept, and only ever as plain
// {role, content} pairs — trusting/replaying anything else the client sends
// here would let arbitrary fields reach the OpenAI call.
const MAX_HISTORY_TURNS = 10;

const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.trim() }));
};

const processVoice = async (text, language = 'English', history = []) => {
  const languageInstruction = language === 'Tagalog'
    ? 'Respond in natural, conversational Tagalog (Filipino) appropriate for a Filipino care home setting. Keep medication/drug names and dosage units in their original form (do not translate them).'
    : 'Respond in English only. Do not add a Tagalog translation or restate any part of the response in Tagalog, even if the topic feels like it would suit a bilingual Filipino care home audience.';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You are a smart nursing assistant in a care home. You help caregivers with medication management and resident care.

LANGUAGE: ${languageInstruction} This applies regardless of what language the caregiver's message is written in.

STYLE: Never phrase things as litotes (understatement through a double negative, e.g. "not unsafe" instead of "safe", "not uncommon" instead of "common", "not incorrect" instead of "correct"). Always state things directly and plainly, in both English and Tagalog — this matters for clarity in a medical/spoken context where a caregiver shouldn't have to mentally un-negate a sentence to understand it.

MEMORY: The conversation history before this message is real — earlier assistant replies may contain real resident/medication data looked up from the database (not something you made up). If the caregiver's new message is a follow-up referring back to something just discussed ("what are those 3?", "which ones were late?"), answer it directly using that prior context instead of asking them to repeat themselves. Only fall back to "unknown" if the message truly doesn't connect to anything in the conversation.

Classify every message into exactly ONE of these intents:

- "administer" — caregiver is giving/recording a medication dose. E.g., "Administer Paracetamol to Maria Santos at 9 AM room 201", "Give Losartan to Juan". Extract patient, medication, dosage, time, room. Give a short confirmation response.
- "show" — caregiver wants to see/look up information (a resident's medications, schedule, room, etc), for one resident or for all of them. E.g., "Show me Maria's medications", "What's scheduled for room 201", "Show me today's schedule for everyone". Extract whatever of patient/medication/room is mentioned — patient is null if they're asking about all residents. Acknowledge what they're asking to see; you do not have live database access, so make clear you're confirming the request, not reading live records.
- "confirm" — caregiver is confirming something already happened. E.g., "I gave Maria her medication", "Confirmed, administered to Juan". Extract patient, medication. Acknowledge the confirmation.
- "cancel" — caregiver wants to cancel or undo something. E.g., "Cancel that", "Never mind", "Cancel the reminder for Maria". Extract patient/medication if mentioned. Acknowledge the cancellation.
- "symptom_report" — caregiver describes a symptom or health issue. E.g., "Maria has a headache", "Resident has fever", "Patient is dizzy". Identify the symptom, suggest common OTC/prescribed remedies appropriate for elderly care home residents, give practical care advice (rest, hydration, monitoring), and recommend when to escalate to a doctor. Be concise but helpful.
- "health_query" — caregiver asks a general health/medication question not tied to a specific incident. Answer helpfully and safely.
- "unknown" — anything that doesn't clearly fit the above, including follow-ups you can answer directly from the conversation history above (see MEMORY).

Return ONLY valid JSON in this exact format:
{
  "intent": "administer | show | confirm | cancel | symptom_report | health_query | unknown",
  "patient": "patient name or null",
  "medication": "medication name or null",
  "dosage": "dosage or null",
  "time": "time or null",
  "room": "room number or null",
  "symptom": "detected symptom or note or null",
  "response": "Your helpful response to the caregiver, written per the LANGUAGE instruction above"
}

Always be professional, empathetic, and safety-conscious.`,
      },
      ...sanitizeHistory(history),
      { role: 'user', content: text },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    return {
      intent: 'unknown',
      patient: null,
      medication: null,
      dosage: null,
      time: null,
      room: null,
      symptom: null,
      response: language === 'Tagalog'
        ? 'Natanggap ko ang iyong mensahe pero nagkaproblema sa pagproseso nito. Pakisubukang muli.'
        : 'I received your message but had trouble processing it. Please try again.',
    };
  }
};

const transcribeAudio = async (filePath) => {
  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(require('fs').createReadStream(filePath), 'audio.m4a', { type: 'audio/mp4' }),
    model: 'whisper-1',
  });
  return transcription.text;
};

// The full gpt-4.1, not the mini used for voice: on blurry real-world label
// photos gpt-4.1-mini repeatedly invented plausible-looking drug names
// (e.g. read "Pioglitazone" as "Progesterone") and misread expiry dates,
// while gpt-4.1 read the same photo correctly every time. A wrong
// medication name is worse than a blank field, and this runs once per
// approved flag, so the extra cost is negligible.
const LABEL_MODEL = 'gpt-4.1';

const LABEL_PROMPT = `You are reading photos of ONE medication's packaging (different sides/angles of the same package). Extract what is legible, combining what's visible across all photos. Return ONLY valid JSON in this exact format:
{
  "name": "product name as printed: the brand name if there is one, otherwise the generic name, or null",
  "genericName": "the active ingredient / generic name as printed anywhere on the package (including warnings text), or null",
  "brand": "brand name or null",
  "dosage": "dosage value+unit as a single string, e.g. '500mg', or null",
  "form": "e.g. Tablet, Capsule, Syrup, or null",
  "manufacturer": "manufacturer name or null",
  "expiryDate": "expiry date as YYYY-MM-DD, or null",
  "strength": "amount of active ingredient per unit exactly as printed, e.g. '500 mg' or '500 mg (equivalent to Calcium Carbonate 1,250 mg)', or null",
  "route": "route of administration ONLY if it is printed (e.g. 'Oral'), otherwise null",
  "purpose": "the INDICATION / 'used to treat...' text, or null",
  "instructions": "the DOSAGE AND ADMINISTRATION / directions-for-use text, or null",
  "warnings": "the WARNINGS / PRECAUTIONS / SPECIAL PRECAUTIONS text, or null",
  "contraindications": "the CONTRAINDICATIONS text, or null",
  "sideEffects": "the SIDE EFFECTS / ADVERSE REACTIONS text, or null. A line telling people to REPORT adverse reactions (e.g. 'report to the FDA') is NOT a list of side effects.",
  "drugInteractions": "the DRUG INTERACTIONS text, or null",
  "pregnancy": "the pregnancy / lactation statement, or null",
  "storage": "the storage conditions text, or null"
}
Rules:
- Copy spellings exactly as printed. If text is blurry or partly unreadable, return null for that field — never guess, and never "correct" unclear text into a plausible-looking word.
- For the long text fields (purpose through storage) copy the printed wording as one passage: join wrapped lines and fix hyphenation across line breaks, but do NOT summarise, translate, reword, or add anything that is not printed. Put each section's text only in its own field. If a section is not on the package, or too blurry to copy reliably, return null for it.
- Copy medical terms exactly as printed, even if a word looks like a typo or seems wrong for this particular drug. Never replace it with what you would expect the label to say.
- expiryDate must come from an expiry marking (EXP / Exp. Date / Use before), never a manufacturing date. If only month and year are printed, use the last day of that month.`;

const LONG_TEXT_FIELDS = ['purpose', 'instructions', 'warnings', 'contraindications', 'sideEffects', 'drugInteractions', 'pregnancy', 'storage'];

// Trimmed text or null; a stray array is joined, anything else is dropped.
const cleanText = (value) => {
  const text = Array.isArray(value) ? value.join('\n') : value;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 3000) : null;
};

// A model-suggested expiry only survives if it's a real full date that
// hasn't already passed. A past date is far more likely a misread of
// blurry print than a genuinely expired product being registered, and a
// wrong suggestion is worse than leaving the field for Admin to fill.
const sanitizeExpiry = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date < today ? null : value;
};

// One independent read of the photos. See extractMedicationLabel below for
// why it's always run twice.
const readLabelOnce = async (urls) => {
  const completion = await openai.chat.completions.create({
    model: LABEL_MODEL,
    messages: [
      { role: 'system', content: LABEL_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the medication details from these packaging photos.' },
          ...urls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'high' } })),
        ],
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error('The AI returned a reply that could not be read.');
  }

  return {
    ...data,
    // No separate brand printed (common for generics) — the generic name is the name.
    name: data.name || data.genericName || null,
    expiryDate: sanitizeExpiry(data.expiryDate),
    strength: cleanText(data.strength),
    route: cleanText(data.route),
    ...Object.fromEntries(LONG_TEXT_FIELDS.map((field) => [field, cleanText(data[field])])),
  };
};

// Words only, lower-cased, punctuation/spacing/order ignored — so two reads
// that differ in nothing but a curly vs straight apostrophe, or the order of
// a list, still count as the same text, while any changed word does not.
const wordBag = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ');

// A value is only kept if at least two independent reads produced the same
// words. On blurry photos a section can come and go between reads (the
// Special Precautions text on one test box showed up in only some of them),
// and text that can't be reproduced isn't text to trust. Fields that fail
// this are left blank for Admin to fill in from the photos.
const consensus = (values) => {
  const seen = new Map();
  for (const value of values) {
    if (value == null) continue;
    const key = wordBag(value);
    if (seen.has(key)) return seen.get(key);
    seen.set(key, value);
  }
  return null;
};

const LABEL_FIELDS = ['name', 'genericName', 'brand', 'dosage', 'form', 'manufacturer', 'expiryDate', 'strength', 'route', ...LONG_TEXT_FIELDS];
const LABEL_READS = 3;

// Reads photos of medication packaging (several shots of the same package)
// and pulls out whatever's legible, so an Admin registering a
// caregiver-flagged medication gets a pre-filled form instead of a blank
// one. The photos are read LABEL_READS times in parallel and only fields at
// least two reads agree on are returned. Returns null when there are no
// photos; THROWS on any real failure (API error, unreadable reply) so the
// caller can record why — callers must catch it, since a failed read
// should never block the approval.
const extractMedicationLabel = async (photoUrls) => {
  const urls = [].concat(photoUrls || []).filter(Boolean);
  if (!urls.length) return null;

  const reads = await Promise.all(Array.from({ length: LABEL_READS }, () => readLabelOnce(urls)));
  return Object.fromEntries(LABEL_FIELDS.map((field) => [field, consensus(reads.map((read) => read[field]))]));
};

module.exports = { processVoice, transcribeAudio, extractMedicationLabel };

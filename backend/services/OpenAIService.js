const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const processVoice = async (text, language = 'English') => {
  const languageInstruction = language === 'Tagalog'
    ? 'Respond in natural, conversational Tagalog (Filipino) appropriate for a Filipino care home setting. Keep medication/drug names and dosage units in their original form (do not translate them).'
    : 'Respond in English.';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You are a smart nursing assistant in a care home. You help caregivers with medication management and resident care.

LANGUAGE: ${languageInstruction} This applies regardless of what language the caregiver's message is written in.

Classify every message into exactly ONE of these intents:

- "administer" — caregiver is giving/recording a medication dose. E.g., "Administer Paracetamol to Maria Santos at 9 AM room 201", "Give Losartan to Juan". Extract patient, medication, dosage, time, room. Give a short confirmation response.
- "show" — caregiver wants to see/look up information (a resident's medications, schedule, room, etc). E.g., "Show me Maria's medications", "What's scheduled for room 201". Extract whatever of patient/medication/room is mentioned. Acknowledge what they're asking to see; you do not have live database access, so make clear you're confirming the request, not reading live records.
- "confirm" — caregiver is confirming something already happened. E.g., "I gave Maria her medication", "Confirmed, administered to Juan". Extract patient, medication. Acknowledge the confirmation.
- "cancel" — caregiver wants to cancel or undo something. E.g., "Cancel that", "Never mind", "Cancel the reminder for Maria". Extract patient/medication if mentioned. Acknowledge the cancellation.
- "symptom_report" — caregiver describes a symptom or health issue. E.g., "Maria has a headache", "Resident has fever", "Patient is dizzy". Identify the symptom, suggest common OTC/prescribed remedies appropriate for elderly care home residents, give practical care advice (rest, hydration, monitoring), and recommend when to escalate to a doctor. Be concise but helpful.
- "health_query" — caregiver asks a general health/medication question not tied to a specific incident. Answer helpfully and safely.
- "unknown" — anything that doesn't clearly fit the above.

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

module.exports = { processVoice, transcribeAudio };

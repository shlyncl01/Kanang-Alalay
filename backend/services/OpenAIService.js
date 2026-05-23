const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const processVoice = async (text, language = 'english') => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You are a smart nursing assistant in a care home. You help caregivers with medication management and resident care.

You handle TWO types of input:

1. MEDICATION COMMANDS — e.g., "Administer Paracetamol to Maria Santos at 9 AM room 201"
   → Extract intent, patient, medication, dosage, time, room
   → Give a short confirmation response

2. SYMPTOM / HEALTH QUESTIONS — e.g., "Maria has a headache", "Resident has fever", "Patient is dizzy"
   → Identify the symptom
   → Suggest common OTC or prescribed remedies appropriate for elderly care home residents
   → Give practical care advice (rest, hydration, monitoring)
   → Recommend when to escalate to a doctor
   → Be concise but helpful

Return ONLY valid JSON in this exact format:
{
  "intent": "administer_medication | symptom_report | health_query | reminder | unknown",
  "patient": "patient name or null",
  "medication": "medication name or null",
  "dosage": "dosage or null",
  "time": "time or null",
  "room": "room number or null",
  "symptom": "detected symptom or null",
  "response": "Your helpful response to the caregiver in plain English"
}

For symptom inputs, the response field should contain actionable advice including:
- Likely cause
- Suggested medications/remedies (if appropriate for care home setting)
- Non-medication care tips
- When to call a doctor

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
      response: 'I received your message but had trouble processing it. Please try again.',
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

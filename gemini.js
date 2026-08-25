const { GoogleGenAI, Type } = require('@google/genai');

let ai = null;

function initGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[GEMINI ERROR] Missing GEMINI_API_KEY environment variable!');
    return;
  }
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('[GEMINI] Initialized successfully.');
}

async function analyzeMessage(username, messageText, botPos) {
  if (!ai) return null;

  try {
    const prompt = `You are Alice, an AI companion in Minecraft Bedrock Edition.
Player "${username}" said: "${messageText}".
Your current position is X:${Math.round(botPos.x)}, Y:${Math.round(botPos.y)}, Z:${Math.round(botPos.z)}.

Decide whether to reply with text or perform an action.
Respond ONLY in valid JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ['text', 'function']
            },
            text: {
              type: Type.STRING,
              description: 'Message to respond in chat if type is text'
            },
            action: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  enum: ['chatMessage']
                },
                args: {
                  type: Type.OBJECT,
                  properties: {
                    message: { type: Type.STRING }
                  }
                }
              }
            }
          },
          required: ['type']
        }
      }
    });

    const resultText = response.text();
    return JSON.parse(resultText);
  } catch (err) {
    console.error('[GEMINI ERROR]', err.message || err);
    return null;
  }
}

module.exports = { initGemini, analyzeMessage };
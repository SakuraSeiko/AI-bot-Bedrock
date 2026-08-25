const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

let ai = null;

function initGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[GEMINI ERROR] Missing GEMINI_API_KEY environment variable!');
    return;
  }
  ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            type: {
              type: SchemaType.STRING,
              enum: ['text', 'function']
            },
            text: {
              type: SchemaType.STRING,
              description: 'Message to respond in chat if type is text'
            },
            action: {
              type: SchemaType.OBJECT,
              properties: {
                name: {
                  type: SchemaType.STRING,
                  enum: ['chatMessage']
                },
                args: {
                  type: SchemaType.OBJECT,
                  properties: {
                    message: { type: SchemaType.STRING }
                  }
                }
              }
            }
          },
          required: ['type']
        }
      }
    });

    const response = await model.generateContent(prompt);
    const resultText = response.response.text();
    return JSON.parse(resultText);
  } catch (err) {
    console.error('[GEMINI ERROR]', err.message || err);
    return null;
  }
}

module.exports = { initGemini, analyzeMessage };

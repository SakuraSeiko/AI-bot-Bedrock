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
    const prompt = `You are Alice, an autonomous AI companion living inside Minecraft Bedrock Edition.
Player "${username}" said: "${messageText}".
Your current coordinates are X:${Math.round(botPos.x)}, Y:${Math.round(botPos.y)}, Z:${Math.round(botPos.z)}.

Decide how to respond. You can talk, move around, teleport if necessary, jump, or interact with the world.
Respond ONLY in valid JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
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
              description: 'Chat response message if type is text'
            },
            action: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  enum: ['chatMessage', 'moveTo', 'teleport', 'jump', 'dig']
                },
                args: {
                  type: Type.OBJECT,
                  properties: {
                    message: { type: Type.STRING, description: 'Message to say in chat' },
                    x: { type: Type.NUMBER, description: 'Target X coordinate' },
                    y: { type: Type.NUMBER, description: 'Target Y coordinate' },
                    z: { type: Type.NUMBER, description: 'Target Z coordinate' },
                    blockName: { type: Type.STRING, description: 'Name of the block to dig or interact with' }
                  }
                }
              }
            }
          },
          required: ['type']
        }
      }
    });

    const resultText = response.text;
    return JSON.parse(resultText);
  } catch (err) {
    console.error('[GEMINI ERROR]', err.message || err);
    return null;
  }
}

module.exports = { initGemini, analyzeMessage };

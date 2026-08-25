const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

function initGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[GEMINI ERROR] Missing GEMINI_API_KEY environment variable!');
    return;
  }
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });
  console.log('[GEMINI] Initialized successfully.');
}

async function analyzeMessage(username, messageText, botPos) {
  if (!model) return null;

  try {
    const prompt = `You are Alice, an AI companion in Minecraft Bedrock Edition.
Player "${username}" said: "${messageText}".
Your current position is X:${Math.round(botPos.x)}, Y:${Math.round(botPos.y)}, Z:${Math.round(botPos.z)}.

Decide whether to reply with text or perform an action.
Respond ONLY in valid JSON with this exact structure:
{
  "type": "text" | "function",
  "text": "your response if type is text",
  "action": {
    "name": "chatMessage",
    "args": { "message": "text" }
  }
}`;

    const response = await model.generateContent(prompt);
    const resultText = response.response.text();
    return JSON.parse(resultText);
  } catch (err) {
    console.error('[GEMINI ERROR]', err.message || err);
    return null;
  }
}

module.exports = { initGemini, analyzeMessage };

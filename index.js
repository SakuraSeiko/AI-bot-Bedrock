const http = require('http');
const bedrockflayer = require('bedrockflayer');
const { initGemini, analyzeMessage } = require('./gemini');

const PORT = process.env.PORT || 3000;

// Serwer HTTP pod Back4App
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Alice Bedrock AI Bot Service is active.\n');
});

server.listen(PORT, () => {
  console.log(`[SYSTEM] Web server listening on port ${PORT}`);
  try {
    initGemini();
  } catch (e) {
    console.error('[GEMINI INIT ERROR]', e);
  }
  startBotSafely();
});

let currentBot = null;
let reconnectTimer = null;

function startBotSafely() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  
  try {
    initBot();
  } catch (err) {
    console.error('[CRITICAL BOT LAUNCH ERROR]', err.message || err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log('[BOT] Scheduling reconnect in 10 seconds...');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBotSafely();
  }, 10000);
}

function initBot() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[ERROR] GEMINI_API_KEY environment variable is missing!');
    return;
  }

  const host = process.env.BEDROCK_HOST || 'BakaAdv.aternos.me';
  const port = parseInt(process.env.BEDROCK_PORT || '11008', 10);

  console.log(`[BOT] Connecting to Bedrock server ${host}:${port} as Alice...`);

  if (currentBot) {
    try {
      currentBot.quit();
    } catch (e) {}
    currentBot = null;
  }

  // Tworzenie bota z silnikiem fizycznym Mineflayera
  const bot = bedrockflayer.createBot({
    host: host,
    port: port,
    username: 'Alice',
    offline: true,
    version: '1.26.40'
  });

  currentBot = bot;

  let isProcessing = false;
  let isSpawned = false;

  bot.on('spawn', () => {
    console.log('[BOT] Alice fully spawned into the world with physical engine enabled!');
    isSpawned = true;
  });

  bot.on('chat', async (username, messageText) => {
    console.log(`[RAW CHAT] Source: "${username}", Text: "${messageText}"`);

    // IGNOROWANIE WŁASNYCH WIADOMOŚCI ORAZ KLONÓW ALICE
    const isAliceSelf = 
      username === bot.username || 
      username.startsWith('Alice') ||
      messageText.startsWith('* Alice') ||
      messageText.startsWith('Alice:');

    if (
      !messageText.trim() || 
      isAliceSelf ||
      messageText.includes('%') ||
      messageText.includes('rawtext') ||
      messageText.includes('commands.')
    ) {
      return;
    }

    console.log(`[PROCESSING CHAT] ${username}: ${messageText}`);

    if (isProcessing) return;
    isProcessing = true;

    // Pobieranie pozycji z silnika fizycznego bota
    const botPos = bot.entity ? bot.entity.position : { x: 0, y: 0, z: 0 };

    try {
      const aiResult = await analyzeMessage(username, messageText, botPos);
      if (aiResult) {
        if (aiResult.type === 'text' && aiResult.text) {
          sendChat(bot, aiResult.text.trim(), isSpawned);
        } else if (aiResult.type === 'function' && aiResult.action) {
          if (aiResult.action.name === 'chatMessage' && aiResult.action.args?.message) {
            sendChat(bot, aiResult.action.args.message, isSpawned);
          }
        }
      }
    } catch (err) {
      console.error('[GEMINI ERROR]', err.message || err);
    } finally {
      isProcessing = false;
    }
  });

  bot.on('error', (err) => {
    console.error('[BOT ERROR]', err.message || err);
    scheduleReconnect();
  });

  bot.on('end', () => {
    console.log('[BOT] Connection ended.');
    isSpawned = false;
    scheduleReconnect();
  });
}

function sendChat(bot, message, isSpawned) {
  try {
    const cleanMessage = String(message).trim();
    if (!cleanMessage) return;

    if (!isSpawned) {
      console.log('[CHAT CANCELLED] Bot not fully spawned yet.');
      return;
    }

    bot.chat(cleanMessage);
    console.log(`[BOT SENT CHAT] ${cleanMessage}`);
  } catch (err) {
    console.error('[CHAT ERROR]', err.message || err);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message || err);
  scheduleReconnect();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

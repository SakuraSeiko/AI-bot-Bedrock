const http = require('http');
const bedrockflayer = require('bedrockflayer');
const { initGemini, analyzeMessage } = require('./gemini');

const PORT = process.env.PORT || 3000;

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

  const bot = bedrockflayer.createBot({
    host: host,
    port: port,
    username: 'Alice',
    offline: true,
    version: '1.26.40',
    skipPing: true,
    connectTimeout: 30000
  });

  currentBot = bot;

  let isProcessing = false;
  let isSpawned = false;

  bot.on('spawn', () => {
    console.log('[BOT] Alice fully spawned into the world!');
    isSpawned = true;

    // Zabezpieczenie fizyki bedrockflayer przed błędem "Cannot read properties of undefined (reading 'x')"
    if (!bot.entity) {
      bot.entity = { position: { x: 0, y: 0, z: 0 } };
    } else if (!bot.entity.position) {
      bot.entity.position = { x: 0, y: 0, z: 0 };
    }
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

    const botPosition = bot.entity ? bot.entity.position : { x: 0, y: 0, z: 0 };

    try {
      const aiResult = await analyzeMessage(username, messageText, botPosition);
      if (aiResult) {
        if (aiResult.type === 'text' && aiResult.text) {
          sendBedrockChat(bot, aiResult.text.trim(), isSpawned);
        } else if (aiResult.type === 'function' && aiResult.action) {
          if (aiResult.action.name === 'chatMessage' && aiResult.action.args?.message) {
            sendBedrockChat(bot, aiResult.action.args.message, isSpawned);
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

function sendBedrockChat(bot, message, isSpawned) {
  try {
    const cleanMessage = String(message).trim();
    if (!cleanMessage) return;

    if (!isSpawned) {
      console.log('[CHAT CANCELLED] Bot not fully spawned yet.');
      return;
    }

    const client = bot._client || bot.client;

    if (!client) {
      console.error('[CHAT ERROR] Underlying bedrock client not available.');
      return;
    }

    client.queue('command_request', {
      command: `/me ${cleanMessage}`,
      version: 'latest',
      origin: {
        type: 'player',
        uuid: client.uuid || '00000000-0000-0000-0000-000000000000',
        request_id: '00000000-0000-0000-0000-000000000000',
        player_entity_id: BigInt(client.entityId || 0)
      },
      internal: false
    });

    console.log(`[BOT SENT CHAT VIA /ME] ${cleanMessage}`);
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

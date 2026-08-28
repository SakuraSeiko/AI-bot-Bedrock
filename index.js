const http = require('http');
const bedrock = require('bedrock-protocol');
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

let currentClient = null;
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

  if (currentClient) {
    try {
      currentClient.removeAllListeners();
      currentClient.close();
    } catch (e) {}
    currentClient = null;
  }

  const client = bedrock.createClient({
    host: host,
    port: port,
    username: 'Alice',
    offline: true,
    version: '1.26.40',
    skipPing: true,
    connectTimeout: 30000
  });

  currentClient = client;

  let botPosition = { x: 0, y: 0, z: 0 };
  let isProcessing = false;
  let isSpawned = false;

  client.on('join', () => {
    console.log('[BOT] Alice joined server, waiting for world spawn...');
  });

  client.on('spawn', () => {
    console.log('[BOT] Alice fully spawned into the world!');
    isSpawned = true;
  });

  client.on('disconnect', (packet) => {
    console.log('[BDS KICK REASON]', JSON.stringify(packet));
  });

  client.on('move_player', (packet) => {
    if (packet.runtime_id === client.entityId) {
      botPosition = packet.position;
    }
  });

  client.on('text', async (packet) => {
    const messageText = packet.message || packet.param2 || '';
    const sourceName = packet.source_name || packet.param1 || '';

    console.log(`[RAW CHAT] Source: "${sourceName}", Text: "${messageText}"`);

    if (
      !messageText.trim() || 
      sourceName === client.username || 
      sourceName.includes('Alice') ||
      messageText.includes('%') ||
      messageText.includes('rawtext') ||
      messageText.includes('commands.')
    ) {
      return;
    }

    console.log(`[PROCESSING CHAT] ${sourceName}: ${messageText}`);

    if (isProcessing) return;
    isProcessing = true;

    try {
      const aiResult = await analyzeMessage(sourceName, messageText, botPosition);
      if (aiResult) {
        if (aiResult.type === 'text' && aiResult.text) {
          sendBedrockChat(client, aiResult.text.trim(), isSpawned);
        } else if (aiResult.type === 'function' && aiResult.action) {
          if (aiResult.action.name === 'chatMessage' && aiResult.action.args?.message) {
            sendBedrockChat(client, aiResult.action.args.message, isSpawned);
          }
        }
      }
    } catch (err) {
      console.error('[GEMINI ERROR]', err.message || err);
    } finally {
      isProcessing = false;
    }
  });

  client.on('error', (err) => {
    console.error('[BOT ERROR]', err.message || err);
    scheduleReconnect();
  });

  client.on('close', () => {
    console.log('[BOT] Connection closed.');
    isSpawned = false;
    scheduleReconnect();
  });
}

function sendBedrockChat(client, message, isSpawned) {
  try {
    const cleanMessage = String(message).trim();
    if (!cleanMessage) return;

    if (!isSpawned) {
      console.log('[CHAT CANCELLED] Bot not fully spawned yet.');
      return;
    }

    // Format zgodny ze specyfikacją Bedrock 1.26.x
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

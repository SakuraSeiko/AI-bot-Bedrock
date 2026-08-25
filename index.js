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
  initGemini();
  initBot();
});

function initBot() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[ERROR] GEMINI_API_KEY environment variable is missing!');
    return;
  }

  const host = process.env.BEDROCK_HOST || 'BakaAdv.aternos.me';
  const port = parseInt(process.env.BEDROCK_PORT || '11008', 10);

  console.log(`[BOT] Connecting to Bedrock server ${host}:${port}...`);

  let client;

  try {
    client = bedrock.createClient({
      host: host,
      port: port,
      username: 'Alice',
      offline: true,
      version: '1.26.40',
      skipPing: true // Musi być true, żeby nie wywalało błędnego ping timed out przed połączeniem!
    });
  } catch (err) {
    console.error('[BOT INIT ERROR]', err.message || err);
    console.log('[BOT] Retrying connection in 5 seconds...');
    setTimeout(initBot, 5000);
    return;
  }

  let botPosition = { x: 0, y: 0, z: 0 };
  let isProcessing = false;

  client.on('start_game', (packet) => {
    if (packet.player_position) {
      botPosition = packet.player_position;
    }
    client.queue('set_local_player_as_initialized', {
      runtime_entity_id: packet.runtime_entity_id
    });
    console.log('[BOT] Sent player initialization packet to server.');
  });

  client.on('spawn', () => {
    console.log('[BOT] Alice fully spawned into the Bedrock world!');
  });

  client.on('move_player', (packet) => {
    if (packet.runtime_id === client.entityId) {
      botPosition = packet.position;
    }
  });

  client.on('text', async (packet) => {
    const messageText = packet.message;
    const sourceName = packet.source_name || packet.param1 || 'Player';

    if (!messageText || sourceName === 'Alice' || sourceName === client.username) return;

    console.log(`[BEDROCK CHAT] ${sourceName}: ${messageText}`);

    if (isProcessing) return;
    isProcessing = true;

    try {
      const aiResult = await analyzeMessage(sourceName, messageText, botPosition);
      if (aiResult) {
        if (aiResult.type === 'text' && aiResult.text) {
          sendBedrockChat(client, aiResult.text.trim());
        } else if (aiResult.type === 'function' && aiResult.action) {
          if (aiResult.action.name === 'chatMessage' && aiResult.action.args?.message) {
            sendBedrockChat(client, aiResult.action.args.message);
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
    // Jeśli wywali błąd połączenia po zainicjowaniu, wymuszamy rozłączenie i reconnect
    client.close();
  });

  client.on('close', () => {
    console.log('[BOT] Connection closed. Reconnecting in 5 seconds...');
    setTimeout(initBot, 5000);
  });
}

function sendBedrockChat(client, message) {
  try {
    client.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      xuid: '',
      platform_chat_id: '',
      message: message
    });
    console.log(`[BOT SENT] ${message}`);
  } catch (err) {
    console.error('[CHAT ERROR]', err.message || err);
  }
}

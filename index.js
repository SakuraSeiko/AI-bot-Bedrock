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

  const client = bedrock.createClient({
    host: host,
    port: port,
    username: 'Alice',
    offline: true,
    version: '1.26.40',
    skipPing: true,
    connectTimeout: 30000
  });

  let botPosition = { x: 0, y: 0, z: 0 };
  let isProcessing = false;

  client.on('join', () => {
    console.log('[BOT] Alice successfully joined the Bedrock world!');
  });

  client.on('move_player', (packet) => {
    if (packet.runtime_id === client.entityId) {
      botPosition = packet.position;
    }
  });

  client.on('text', async (packet) => {
    const messageText = packet.message || packet.param2 || '';
    const sourceName = packet.source_name || packet.param1 || 'Player';

    // Rygorystyczne filtrowanie: ignoruj puste, własne, systemowe oraz komunikaty od "Player"
    if (
      !messageText.trim() || 
      sourceName.includes('Alice') || 
      sourceName === client.username || 
      sourceName === 'Player' ||
      messageText.includes('%') ||
      messageText.startsWith('$')
    ) {
      return;
    }

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
  });

  client.on('close', () => {
    console.log('[BOT] Connection closed. Reconnecting in 20 seconds...');
    setTimeout(initBot, 20000);
  });
}

function sendBedrockChat(client, message) {
  try {
    const cleanMessage = String(message).trim();
    if (!cleanMessage) return;

    // Wysyłanie jako komenda interakcji ze światem zamiast niestabilnego pakietu czatu
    client.queue('command_request', {
      command: `/me ${cleanMessage}`,
      origin: {
        type: 0,
        uuid: '',
        request_id: '',
        player_entity_id: 0
      },
      internal: false,
      version: 66
    });
    console.log(`[BOT SENT CMD] ${cleanMessage}`);
  } catch (err) {
    console.error('[CHAT ERROR]', err.message || err);
  }
}

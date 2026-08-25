const http = require('http');
const bedrock = require('bedrock-protocol');
const { initGemini, analyzeMessage } = require('./gemini');

const PORT = process.env.PORT || 3000;

// HTTP server required for Render uptime checks
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

  // Set host and port for your Bedrock server
  const host = process.env.BEDROCK_HOST || 'BakaAdv.aternos.me';
  const port = parseInt(process.env.BEDROCK_PORT || '11008', 10);

  console.log(`[BOT] Connecting to Bedrock server ${host}:${port}...`);

  const client = bedrock.createClient({
    host: host,
    port: port,
    username: 'Alice',
    offline: true, // Set to false if connecting to an online-mode Xbox server
    version: '1.26.40.8'
  });

  let botPosition = { x: 0, y: 0, z: 0 };

  // Finalize handshake to fully spawn into the Bedrock world as an active player
  client.on('start_game', (packet) => {
    client.queue('set_local_player_as_initialized', {
      runtime_entity_id: packet.runtime_entity_id
    });
    console.log('[BOT] Sent player initialization packet to server.');
  });

  client.on('spawn', () => {
    console.log('[BOT] Alice fully spawned into the Bedrock world!');
  });

  // Track player coordinates from Bedrock packets
  client.on('move_player', (packet) => {
    if (packet.runtime_id === client.entityId) {
      botPosition = packet.position;
    }
  });

  // Listen for incoming chat messages
  client.on('text', async (packet) => {
    const messageText = packet.message;
    const sourceName = packet.source_name || packet.param1 || 'Player';

    // Ignore empty messages or self messages
    if (!messageText || sourceName === 'Alice' || sourceName === client.username) return;

    console.log(`[BEDROCK CHAT] ${sourceName}: ${messageText}`);

    const aiResult = await analyzeMessage(sourceName, messageText, botPosition);
    if (!aiResult) return;

    if (aiResult.type === 'text' && aiResult.text) {
      sendBedrockChat(client, aiResult.text.trim());
    } else if (aiResult.type === 'function' && aiResult.action) {
      if (aiResult.action.name === 'chatMessage' && aiResult.action.args?.message) {
        sendBedrockChat(client, aiResult.action.args.message);
      }
    }
  });

  client.on('error', (err) => {
    console.error('[BOT ERROR]', err.message || err);
  });

  client.on('close', () => {
    console.log('[BOT] Connection closed. Reconnecting in 10 seconds...');
    setTimeout(initBot, 10000);
  });
}

function sendBedrockChat(client, message) {
  client.queue('text', {
    type: 'chat',
    needs_translation: false,
    source_name: client.username,
    xuid: '',
    platform_chat_id: '',
    message: message
  });
  console.log(`[BOT SENT] ${message}`);
}

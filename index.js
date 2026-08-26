const http = require('http');
const dns = require('dns');
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
  resolveAndStart();
});

function resolveAndStart() {
  const host = process.env.BEDROCK_HOST || 'BakaAdv.aternos.me';
  
  // Automatyczne sprawdzenie numeru IP bezpośrednio w Node.js
  dns.lookup(host, (err, address) => {
    if (err) {
      console.error(`[DNS ERROR] Nie udalo sie pobrac IP dla ${host}:`, err.message);
      initBot(host); // Proba polaczenia po domenie w razie bledu
    } else {
      console.log(`[DNS SUCCESS] Domena ${host} wskazuje na IP: ${address}`);
      initBot(address); // Przekazanie czystego IP do bota
    }
  });
}

function initBot(targetHost) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[ERROR] GEMINI_API_KEY environment variable is missing!');
    return;
  }

  const port = parseInt(process.env.BEDROCK_PORT || '11008', 10);

  console.log(`[BOT] Connecting to Bedrock server ${targetHost}:${port}...`);

  const client = bedrock.createClient({
    host: targetHost,
    port: port,
    username: 'Alice',
    offline: true,
    version: '1.26.40',
    skipPing: true,
    followPort: false,
    raknetBackend: 'raknet-native',
    connectTimeout: 15000
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

    if (!messageText.trim() || sourceName.includes('Alice') || sourceName === client.username) return;

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
    console.log('[BOT] Connection closed. Reconnecting in 10 seconds...');
    setTimeout(resolveAndStart, 10000);
  });
}

function sendBedrockChat(client, message) {
  try {
    client.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      message: message,
      xuid: '',
      platform_chat_id: '',
      filtered_message: ''
    });
    console.log(`[BOT SENT] ${message}`);
  } catch (err) {
    console.error('[CHAT ERROR]', err.message || err);
  }
}

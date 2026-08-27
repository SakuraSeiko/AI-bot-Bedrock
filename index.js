const bedrock = require('bedrock-protocol');
const { getGeminiResponse } = require('./gemini');

const host = process.env.MC_HOST;
const port = parseInt(process.env.MC_PORT, 10);

let botPosition = { x: 0, y: 0, z: 0 };

function sendBedrockChat(client, message) {
  try {
    const cleanMessage = String(message).trim();
    if (!cleanMessage) return;

    client.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      message: cleanMessage,
      filtered_message: '',
      xuid: '',
      platform_chat_id: ''
    });
    console.log(`[BOT SENT] ${cleanMessage}`);
  } catch (err) {
    console.error('[CHAT ERROR]', err.message || err);
  }
}

function initBot() {
  console.log('[BOT] Łączenie z serwerem Bedrock...');

  const client = bedrock.createClient({
    host: host,
    port: port,
    username: 'Alice',
    offline: true,
    version: '1.26.40',
    skipPing: true,
    connectTimeout: 30000
  });

  client.on('join', () => {
    console.log('[BOT] Alice pomyślnie dołączyła do świata!');
  });

  client.on('move_player', (packet) => {
    if (packet.runtime_id === client.entityId || packet.position) {
      botPosition = {
        x: Math.round(packet.position.x),
        y: Math.round(packet.position.y),
        z: Math.round(packet.position.z)
      };
    }
  });

  client.on('text', async (packet) => {
    const sender = packet.source_name;
    const message = packet.message;

    if (!message || sender === client.username || sender === 'Alice') return;
    if (message.startsWith('%')) return;

    console.log(`[CHAT] ${sender}: ${message}`);

    const replyText = await getGeminiResponse(sender, message, botPosition);
    if (replyText) {
      sendBedrockChat(client, replyText);
    }
  });

  client.on('error', (err) => {
    console.error('[CLIENT ERROR]', err.message || err);
  });

  client.on('close', () => {
    console.log('[BOT] Połączenie zamknięte. Ponawianie za 20 sekund...');
    setTimeout(initBot, 20000);
  });
}

initBot();

let client = null;

function initBot() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[ERROR] GEMINI_API_KEY environment variable is missing!');
    return;
  }

  const host = process.env.BEDROCK_HOST || 'BakaAdv.aternos.me';
  const port = parseInt(process.env.BEDROCK_PORT || '11008', 10);

  console.log(`[BOT] Connecting to Bedrock server ${host}:${port}...`);

  client = bedrock.createClient({
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
  let hasReconnected = false;

  // Jednolita funkcja do ponawiania połączenia, zapobiegająca podwójnemu wywołaniu
  const triggerReconnect = (reason) => {
    if (hasReconnected) return;
    hasReconnected = true;

    console.log(`[BOT] ${reason}. Reconnecting in 10 seconds...`);
    
    if (client) {
      try { client.close(); } catch (e) {}
    }

    setTimeout(() => {
      initBot();
    }, 10000);
  };

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
    const sourceName = packet.source_name || packet.param1 || '';

    console.log(`[RAW CHAT] Source: "${sourceName}", Text: "${messageText}"`);

    if (
      !messageText.trim() || 
      sourceName === client.username || 
      sourceName.includes('Alice') ||
      messageText.includes('%')
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

  // Reagujemy zarówno na błąd (w tym Connect timed out), jak i na zamknięcie gniazda
  client.on('error', (err) => {
    console.error('[BOT ERROR]', err.message || err);
    triggerReconnect(`Error occurred (${err.message || err})`);
  });

  client.on('close', () => {
    triggerReconnect('Connection closed');
  });
}

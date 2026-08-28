const http = require('http');
const bedrock = require('bedrock-protocol');
const { initGemini, analyzeMessage } = require('./gemini');
const { moveToTarget, teleportTo, jump, digBlock } = require('./movement');

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
let tickLoop = null;

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
  if (tickLoop) {
    clearInterval(tickLoop);
    tickLoop = null;
  }
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
      if (tickLoop) clearInterval(tickLoop);
      currentClient.removeAllListeners();
      currentClient.close();
    } catch (e) {}
    currentClient = null;
    tickLoop = null;
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
  const playerPositions = {}; 
  let isProcessing = false;
  let isSpawned = false;

  client.on('join', () => {
    console.log('[BOT] Alice joined server, waiting for resource packs...');
  });

  // Oficjalna sekwencja obsługi zasobów i ticków wyciągnięta z dumpPackets.js
  client.once('resource_packs_info', (packet) => {
    console.log('[BOT] Handling resource packs info...');
    client.write('resource_pack_client_response', {
      response_status: 'completed',
      response_status_name: 'resourcepackstackfinished',
      resourcepackids: []
    });

    client.once('resource_pack_stack', (stack) => {
      client.write('resource_pack_client_response', {
        response_status: 'completed',
        response_status_name: 'resourcepackstackfinished',
        resourcepackids: []
      });
    });

    client.queue('client_cache_status', { enabled: false });
    client.queue('request_chunk_radius', { chunk_radius: 2 });

    if (tickLoop) clearInterval(tickLoop);
    tickLoop = setInterval(() => {
      try {
        client.queue('tick_sync', { 
          request_time: BigInt(Date.now()), 
          response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 200);
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
    } else {
      for (const [name, data] of Object.entries(playerPositions)) {
        if (data.runtimeId === packet.runtime_id) {
          data.position = packet.position;
          break;
        }
      }
    }
  });

  client.on('player_list', (packet) => {
    if (packet.records && packet.records.records) {
      for (const record of packet.records.records) {
        if (record.username && record.username !== client.username) {
          if (!playerPositions[record.username]) {
            playerPositions[record.username] = { runtimeId: null, position: { x: 0, y: 0, z: 0 } };
          }
        }
      }
    }
  });

  client.on('add_player', (packet) => {
    if (packet.username) {
      playerPositions[packet.username] = {
        runtimeId: packet.runtime_id,
        position: packet.position || { x: 0, y: 0, z: 0 }
      };
      console.log(`[TRACKING] Discovered player entity: ${packet.username} (Runtime ID: ${packet.runtime_id})`);
    }
  });

  client.on('text', async (packet) => {
    const messageText = packet.message || packet.param2 || '';
    const sourceName = packet.source_name || packet.param1 || '';

    console.log(`[RAW CHAT] Source: "${sourceName}", Text: "${messageText}"`);

    const isAliceSelf = 
      sourceName === client.username || 
      sourceName.startsWith('Alice') ||
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

    console.log(`[PROCESSING CHAT] ${sourceName}: ${messageText}`);

    if (isProcessing) return;
    isProcessing = true;

    try {
      const targetPlayerPos = playerPositions[sourceName]?.position || null;

      const aiResult = await analyzeMessage(sourceName, messageText, botPosition, targetPlayerPos);
      if (aiResult) {
        if (aiResult.type === 'text' && aiResult.text) {
          sendBedrockChat(client, aiResult.text.trim(), isSpawned);
        } else if (aiResult.type === 'function' && aiResult.action) {
          const action = aiResult.action;
          
          if (action.name === 'chatMessage' && action.args?.message) {
            sendBedrockChat(client, action.args.message, isSpawned);
          } else if (action.name === 'moveTo') {
            const { x, y, z } = action.args;
            if (x !== undefined && y !== undefined && z !== undefined) {
              moveToTarget(client, botPosition, x, y, z);
              sendBedrockChat(client, "I'm moving there now!", isSpawned);
            }
          } else if (action.name === 'teleport') {
            const { x, y, z } = action.args;
            if (x !== undefined && y !== undefined && z !== undefined) {
              teleportTo(client, x, y, z);
              sendBedrockChat(client, "Teleporting!", isSpawned);
            }
          } else if (action.name === 'jump') {
            jump(client, botPosition);
            sendBedrockChat(client, "Whee!", isSpawned);
          } else if (action.name === 'dig') {
            digBlock(client, action.args?.blockName);
            sendBedrockChat(client, `Trying to dig ${action.args?.blockName || 'block'}!`, isSpawned);
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
    if (tickLoop) {
      clearInterval(tickLoop);
      tickLoop = null;
    }
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

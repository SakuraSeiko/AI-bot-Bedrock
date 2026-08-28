// movement.js - Low-level movement and action handler for bedrock-protocol

function sendMovementPacket(client, newX, newY, newZ, pitch = 0, yaw = 0) {
  try {
    if (!client || !client.entityId) return;

    client.queue('move_player', {
      runtime_id: client.entityId,
      position: { x: newX, y: newY, z: newZ },
      pitch: pitch,
      yaw: yaw,
      head_yaw: yaw,
      mode: 'normal',
      on_ground: true,
      riding_runtime_id: 0n,
      tick: 0n
    });
    
    console.log(`[MOVEMENT] Moved to X:${newX}, Y:${newY}, Z:${newZ}`);
  } catch (err) {
    console.error('[MOVEMENT ERROR]', err.message || err);
  }
}

function moveToTarget(client, currentPos, targetX, targetY, targetZ) {
  // Direct position update step (can be expanded to pathfinding steps later)
  sendMovementPacket(client, targetX, targetY, targetZ);
}

function teleportTo(client, x, y, z) {
  try {
    // Fallback/direct command or packet teleport for high mobility
    client.queue('command_request', {
      command: `/tp Alice ${x} ${y} ${z}`,
      version: 'latest',
      origin: {
        type: 'player',
        uuid: client.uuid || '00000000-0000-0000-0000-000000000000',
        request_id: '00000000-0000-0000-0000-000000000000',
        player_entity_id: BigInt(client.entityId || 0)
      },
      internal: false
    });
    console.log(`[MOVEMENT] Teleported to X:${x}, Y:${y}, Z:${z}`);
  } catch (err) {
    console.error('[TELEPORT ERROR]', err.message || err);
  }
}

function jump(client, currentPos) {
  try {
    // Simple vertical hop simulation using move packets
    const jumpHeight = 1.25;
    sendMovementPacket(client, currentPos.x, currentPos.y + jumpHeight, currentPos.z);
    setTimeout(() => {
      sendMovementPacket(client, currentPos.x, currentPos.y, currentPos.z);
    }, 500);
    console.log('[MOVEMENT] Jump executed.');
  } catch (err) {
    console.error('[JUMP ERROR]', err.message || err);
  }
}

function digBlock(client, blockName) {
  console.log(`[ACTION] Digging requested for block: ${blockName || 'target'}`);
  // Place holder for block interaction packets (to be implemented as world perception grows)
}

module.exports = { sendMovementPacket, moveToTarget, teleportTo, jump, digBlock };
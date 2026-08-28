// movement.js - Low-level movement, physics, and action handler for bedrock-protocol

let currentTick = 0n;

function sendPlayerAuthInput(client, x, y, z, pitch = 0, yaw = 0, inputData = 0) {
  try {
    if (!client || !client.entityId) return;

    // Increment tick to maintain synchronization with Bedrock Dedicated Server (BDS) physics engine
    currentTick += 1n;

    client.queue('player_auth_input', {
      position: { x: x, y: y, z: z },
      pitch: pitch,
      yaw: yaw,
      head_yaw: yaw,
      move_vector: { x: 0, z: 0 },
      input_data: inputData,
      input_mode: 'mouse',
      play_mode: 'screen',
      interaction_model: 'touch',
      gaze_direction: { x: 0, y: 0, z: 0 },
      tick: currentTick,
      delta_time: 0.05
    });
    
    console.log(`[PHYSICS] Sent player_auth_input tick ${currentTick} at X:${x.toFixed(2)}, Y:${y.toFixed(2)}, Z:${z.toFixed(2)}`);
  } catch (err) {
    console.error('[PHYSICS ERROR]', err.message || err);
  }
}

function sendMovementPacket(client, newX, newY, newZ, pitch = 0, yaw = 0) {
  try {
    if (!client || !client.entityId) return;

    // Fallback/legacy wrapper utilizing auth input to satisfy server physics requirements
    sendPlayerAuthInput(client, newX, newY, newZ, pitch, yaw);
    
    console.log(`[MOVEMENT] Moved to X:${newX}, Y:${newY}, Z:${newZ}`);
  } catch (err) {
    console.error('[MOVEMENT ERROR]', err.message || err);
  }
}

function moveToTarget(client, currentPos, targetX, targetY, targetZ) {
  // Direct position update step using proper auth input framing
  sendMovementPacket(client, targetX, targetY, targetZ);
}

function teleportTo(client, x, y, z) {
  try {
    // Command request fallback for instant high-range positioning
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
    // Vertical hop simulation combined with physics ticks
    const jumpHeight = 1.25;
    sendPlayerAuthInput(client, currentPos.x, currentPos.y + jumpHeight, currentPos.z, 0, 0, 1 << 0); // Flag sample for jump action
    setTimeout(() => {
      sendPlayerAuthInput(client, currentPos.x, currentPos.y, currentPos.z);
    }, 500);
    console.log('[MOVEMENT] Jump executed.');
  } catch (err) {
    console.error('[JUMP ERROR]', err.message || err);
  }
}

function digBlock(client, blockName) {
  console.log(`[ACTION] Digging requested for block: ${blockName || 'target'}`);
  // Placeholder for block breaking transaction packets
}

module.exports = { sendMovementPacket, moveToTarget, teleportTo, jump, digBlock, sendPlayerAuthInput };

import { Instance } from "cs_script/point_script";

// ==============================
// CONFIG
// ==============================
const UPDATE_RATE = 0.05; // 20 Hz
const MAX_TRACE_DISTANCE = 5000;

// ==============================
// Helpers
// ==============================

function anglesToForward(angles) {
    const pitch = angles.pitch * Math.PI / 180;
    const yaw   = angles.yaw   * Math.PI / 180;

    return {
        x: Math.cos(pitch) * Math.cos(yaw),
        y: Math.cos(pitch) * Math.sin(yaw),
        z: -Math.sin(pitch)
    };
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// ==============================
// Get all players
// ==============================

function getPlayers() {
    return Instance.GetEntitiesByClassname("player");
}

// ==============================
// Build player data
// ==============================

function buildPlayerData(players) {

    const result = [];

    for (let i = 0; i < players.length; i++) {
        const p = players[i];

        if (!p || !p.IsAlive()) continue;

        const pos = p.GetAbsOrigin();
        const ang = p.GetEyeAngles();
        const forward = anglesToForward(ang);

        result.push({
            entity: p,
            name: p.GetPlayerName(), // MUST match TeamSpeak nickname
            x: pos.x,
            y: pos.y,
            z: pos.z,
            fx: forward.x,
            fy: forward.y,
            fz: forward.z
        });
    }

    return result;
}

// ==============================
// Occlusion (listener-based)
// ==============================

function applyOcclusion(playersData) {

    // pick local player as listener (first one for now)
    if (playersData.length === 0) return;

    const listener = playersData[0];

    for (let i = 0; i < playersData.length; i++) {
        const p = playersData[i];

        if (p === listener) {
            p.occluded = 0;
            continue;
        }

        const start = {
            x: listener.x,
            y: listener.y,
            z: listener.z + 64 // eye height approx
        };

        const end = {
            x: p.x,
            y: p.y,
            z: p.z + 64
        };

        const trace = Instance.TraceLine(start, end, 0, listener.entity);

        // If something blocks → occluded
        p.occluded = trace.didHit ? 1 : 0;
    }
}

// ==============================
// Send to Node bridge
// ==============================

function sendToBridge(playersData) {

    const payload = {
        players: playersData.map(p => ({
            name: p.name,
            x: p.x,
            y: p.y,
            z: p.z,
            fx: p.fx,
            fy: p.fy,
            fz: p.fz,
            occluded: p.occluded || 0
        }))
    };

    // NOTE: depends on CS2 HTTP support
    HTTP.Post("http://192.168.0.45:3000/update", JSON.stringify(payload));
}

// ==============================
// Main loop
// ==============================

function tick() {
    const players = getPlayers();
    const data = buildPlayerData(players);

    applyOcclusion(data);
    sendToBridge(data);

    Instance.SetThink(tick, UPDATE_RATE);
}

// ==============================
// Entry point
// ==============================

export function OnActivate() {
    print("CS2 Proximity Script Loaded");
    tick();
}
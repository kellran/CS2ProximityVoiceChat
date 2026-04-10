import { Instance } from "cs_script/point_script";

const UPDATE_RATE = 0.05;

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

// ==============================
// Get players
// ==============================

function getPlayers() {
    return Instance.GetEntitiesByClassname("player");
}

// ==============================
// Build data
// ==============================

function buildPlayerData(players) {
    const result = [];

    for (let p of players) {
        if (!p || !p.IsAlive()) continue;

        const pos = p.GetAbsOrigin();
        const ang = p.GetEyeAngles();
        const fwd = anglesToForward(ang);

        result.push({
            name: p.GetPlayerName(),
            x: pos.x,
            y: pos.y,
            z: pos.z,
            fx: fwd.x,
            fy: fwd.y,
            fz: fwd.z,
            occluded: 0
        });
    }

    return result;
}

// ==============================
// FILE WRITE (NEW BRIDGE)
// ==============================

function sendToBridge(playersData) {
    const payload = {
        players: playersData
    };

    try {
        FileSystem.WriteFile(
            "cs2_data.json",
            JSON.stringify(payload)
        );
    } catch (e) {
        print("WRITE ERROR: " + e);
    }
}

// ==============================
// Main loop
// ==============================

function tick() {
    const players = getPlayers();
    const data = buildPlayerData(players);

    sendToBridge(data);

    Instance.SetThink(tick, UPDATE_RATE);
}

// ==============================
// Entry
// ==============================

export function OnActivate() {
    print("CS2 PROXIMITY SCRIPT LOADED");
    tick();
}
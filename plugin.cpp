#include <thread>
#include <chrono>
#include <string>
#include <map>
#include <cmath>
#include <stdio.h>

#include "ts3/teamspeak/public_definitions.h"
#include "ts3/ts3_functions.h"
#include "ts3/plugin_definitions.h"

#include "external/json.hpp"
using json = nlohmann::json;

static struct TS3Functions ts3Functions;

std::map<std::string, anyID> nameToClientID;

// ==============================
// CONFIG
// ==============================
const float MAX_DISTANCE = 1500.0f;
const float FULL_VOLUME_DISTANCE = 300.0f;
const float SCALE = 0.01f;

// Occlusion strength
const float OCCLUSION_FACTOR = 0.3f; // 30% volume when blocked

// ==============================
// Fetch JSON
// ==============================
std::string fetchData()
{
    FILE *pipe = _popen("curl -s http://192.168.2.163:3000/data", "r");
    if (!pipe)
        return "";

    char buffer[256];
    std::string result;

    while (fgets(buffer, sizeof(buffer), pipe))
    {
        result += buffer;
    }

    _pclose(pipe);
    return result;
}

json getJson()
{
    std::string raw = fetchData();
    if (raw.empty())
        return {};

    try
    {
        return json::parse(raw);
    }
    catch (...)
    {
        return {};
    }
}

// ==============================
// Mapping
// ==============================
void updateClientMapping(uint64 serverConnectionHandlerID)
{
    anyID *clientList;

    if (ts3Functions.getClientList(serverConnectionHandlerID, &clientList) != 0)
        return;

    nameToClientID.clear();

    for (int i = 0; clientList[i]; ++i)
    {
        anyID clientID = clientList[i];

        char *name;
        if (ts3Functions.getClientVariableAsString(
                serverConnectionHandlerID,
                clientID,
                CLIENT_NICKNAME,
                &name) == 0)
        {

            nameToClientID[name] = clientID;
            ts3Functions.freeMemory(name);
        }
    }

    ts3Functions.freeMemory(clientList);
}

// ==============================
// Distance
// ==============================
float distance3D(float x1, float y1, float z1,
                 float x2, float y2, float z2)
{

    float dx = x1 - x2;
    float dy = y1 - y2;
    float dz = z1 - z2;

    return sqrt(dx * dx + dy * dy + dz * dz);
}

// ==============================
// Falloff
// ==============================
float getFalloff(float dist)
{
    if (dist <= FULL_VOLUME_DISTANCE)
        return 1.0f;

    if (dist >= MAX_DISTANCE)
        return 0.0f;

    float t = (dist - FULL_VOLUME_DISTANCE) / (MAX_DISTANCE - FULL_VOLUME_DISTANCE);
    return 1.0f - (t * t);
}

// ==============================
// Main loop
// ==============================
void updateLoop(uint64 serverConnectionHandlerID)
{

    anyID myID;
    ts3Functions.getClientID(serverConnectionHandlerID, &myID);

    int counter = 0;

    while (true)
    {

        if (++counter % 20 == 0)
        {
            updateClientMapping(serverConnectionHandlerID);
        }

        json data = getJson();
        if (!data.contains("players"))
        {
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
            continue;
        }

        // Find listener
        float lx = 0, ly = 0, lz = 0;
        float lfx = 0, lfy = 0, lfz = 0;

        for (auto &p : data["players"])
        {
            std::string name = p["name"];

            if (!nameToClientID.count(name))
                continue;

            if (nameToClientID[name] == myID)
            {
                lx = p["x"];
                ly = p["y"];
                lz = p["z"];

                lfx = p["fx"];
                lfy = p["fy"];
                lfz = p["fz"];
                break;
            }
        }

        TS3_VECTOR listenerPos = {lx * SCALE, lz * SCALE, ly * SCALE};
        TS3_VECTOR forward = {lfx, lfz, lfy};
        TS3_VECTOR up = {0.0f, 1.0f, 0.0f};

        ts3Functions.systemset3DListenerAttributes(
            serverConnectionHandlerID,
            &listenerPos,
            &forward,
            &up);

        // Update others
        for (auto &p : data["players"])
        {

            std::string name = p["name"];

            if (!nameToClientID.count(name))
                continue;

            anyID clientID = nameToClientID[name];
            if (clientID == myID)
                continue;

            float x = p["x"];
            float y = p["y"];
            float z = p["z"];

            int occluded = p.value("occluded", 0);

            float dist = distance3D(lx, ly, lz, x, y, z);
            float falloff = getFalloff(dist);

            // apply occlusion
            if (occluded)
            {
                falloff *= OCCLUSION_FACTOR;
            }

            if (falloff <= 0.01f)
                continue;

            float dx = x - lx;
            float dy = y - ly;
            float dz = z - lz;

            TS3_VECTOR pos = {
                (lx + dx * falloff) * SCALE,
                (lz + dz * falloff) * SCALE,
                (ly + dy * falloff) * SCALE};

            ts3Functions.channelset3DAttributes(
                serverConnectionHandlerID,
                clientID,
                &pos);
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
}

// ==============================
// EXPORTS
// ==============================

const char *ts3plugin_name() { return "CS2 Proximity Chat"; }
const char *ts3plugin_version() { return "1.0"; }
int ts3plugin_apiVersion() { return 26; }
const char *ts3plugin_author() { return "kelran"; }
const char *ts3plugin_description() { return "CS2 proximity with occlusion"; }

void ts3plugin_setFunctionPointers(const struct TS3Functions funcs)
{
    ts3Functions = funcs;
}

int ts3plugin_init() { return 0; }
void ts3plugin_shutdown() {}

void ts3plugin_onConnectStatusChangeEvent(
    uint64 serverConnectionHandlerID,
    int newStatus,
    unsigned int errorNumber)
{
    if (newStatus == STATUS_CONNECTION_ESTABLISHED)
    {
        std::thread(updateLoop, serverConnectionHandlerID).detach();
    }
}
const http = require("http");

let latestData = null;

// ==============================
// SERVER
// ==============================
const server = http.createServer((req, res) => {

    // Allow cross-origin (helps debugging/tools)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "POST" && req.url === "/update") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            // prevent abuse / huge payloads
            if (body.length > 1e6) {
                req.socket.destroy();
            }
        });

        req.on("end", () => {
            try {
                latestData = JSON.parse(body);

                console.log(
                    `[UPDATE] ${latestData.players?.length || 0} players`
                );

            } catch (e) {
                console.error("Invalid JSON:", e.message);
            }

            res.writeHead(200);
            res.end("OK");
        });
    }

    else if (req.method === "GET" && req.url === "/data") {

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(latestData || {}));
    }

    else {
        res.writeHead(404);
        res.end();
    }
});

// ==============================
// IMPORTANT: LISTEN ON NETWORK
// ==============================

const PORT = 3000;
const HOST = "0.0.0.0"; // 🔥 THIS IS THE KEY CHANGE

server.listen(PORT, HOST, () => {
    console.log(`Bridge running on http://0.0.0.0:${PORT}`);
});
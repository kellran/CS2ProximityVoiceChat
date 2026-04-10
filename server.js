const http = require("http");
const fs = require("fs");

let latestData = null;

// ==============================
// FILE POLLING (NEW)
// ==============================

setInterval(() => {
    try {
        const raw = fs.readFileSync("cs2_data.json", "utf8");
        latestData = JSON.parse(raw);
    } catch {
        // ignore if file not ready yet
    }
}, 50);

// ==============================
// HTTP SERVER
// ==============================

const server = http.createServer((req, res) => {

    if (req.method === "GET" && req.url === "/data") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(latestData || {}));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// ==============================
// START SERVER
// ==============================

const PORT = 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Bridge running on http://localhost:${PORT}`);
});
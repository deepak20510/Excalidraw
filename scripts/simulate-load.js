/**
 * Load Testing & Simulation Script for DraftBoard / Excalidraw
 * 
 * Usage: node scripts/simulate-load.js [userCount] [wsUrl]
 * Example: node scripts/simulate-load.js 20 ws://localhost:8082
 */

const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "jwt_secret";
const USER_COUNT = Number(process.argv[2]) || 15;
const WS_URL = process.argv[3] || "ws://localhost:8082";
const TEST_ROOM_ID = 1;
const TEST_DURATION_MS = 6000;

console.log(`\n🚀 Starting DraftBoard Concurrency & Load Benchmark`);
console.log(`--------------------------------------------------`);
console.log(`• Target WebSocket URL: ${WS_URL}`);
console.log(`• Virtual Users:        ${USER_COUNT}`);
console.log(`• Room ID:              ${TEST_ROOM_ID}`);
console.log(`• Duration:             ${TEST_DURATION_MS / 1000}s`);
console.log(`--------------------------------------------------\n`);

let connectedCount = 0;
let messagesSent = 0;
let messagesReceived = 0;
let errorsCount = 0;
const roundTripLatencies = [];

function createClient(index) {
  const userId = `sim_user_${index}`;
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
  const ws = new WebSocket(`${WS_URL}?token=${token}`);

  let pingInterval = null;

  ws.on("open", () => {
    connectedCount++;
    // Join room
    ws.send(JSON.stringify({ type: "join_room", roomId: TEST_ROOM_ID }));

    // Send high-rate cursor updates (simulating 60fps local drawing)
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const sendTime = Date.now();
        ws.send(
          JSON.stringify({
            type: "cursor",
            name: `User ${index}`,
            x: 100 + Math.sin(Date.now() / 200) * 100,
            y: 100 + Math.cos(Date.now() / 200) * 100,
            roomId: TEST_ROOM_ID,
            sendTime,
          })
        );
        messagesSent++;
      }
    }, 16); // 60 FPS
  });

  ws.on("message", (raw) => {
    messagesReceived++;
    try {
      const data = JSON.parse(raw);
      if (data.type === "cursor" && data.sendTime) {
        const latency = Date.now() - data.sendTime;
        if (latency >= 0 && latency < 5000) {
          roundTripLatencies.push(latency);
        }
      }
    } catch (_e) {}
  });

  ws.on("error", () => {
    errorsCount++;
  });

  ws.on("close", () => {
    if (pingInterval) clearInterval(pingInterval);
  });

  return ws;
}

const clients = [];
for (let i = 0; i < USER_COUNT; i++) {
  clients.push(createClient(i + 1));
}

setTimeout(() => {
  clients.forEach((c) => c.close());

  const avgLatency = roundTripLatencies.length
    ? (roundTripLatencies.reduce((a, b) => a + b, 0) / roundTripLatencies.length).toFixed(1)
    : "N/A";
  const p95Latency = roundTripLatencies.length
    ? roundTripLatencies.sort((a, b) => a - b)[Math.floor(roundTripLatencies.length * 0.95)]
    : "N/A";

  console.log(`\n📊 Benchmark Results:`);
  console.log(`--------------------------------------------------`);
  console.log(`• Connected Clients:       ${connectedCount} / ${USER_COUNT}`);
  console.log(`• Messages Sent:           ${messagesSent.toLocaleString()}`);
  console.log(`• Messages Received:       ${messagesReceived.toLocaleString()}`);
  console.log(`• Connection Errors:       ${errorsCount}`);
  console.log(`• Average Cursor Latency:  ${avgLatency} ms`);
  console.log(`• 95th Percentile Latency: ${p95Latency} ms`);
  console.log(`--------------------------------------------------`);

  if (errorsCount === 0 && connectedCount > 0) {
    console.log(`✅ Concurrency load test passed with 0 errors.\n`);
  } else {
    console.log(`ℹ️ Test completed. Note: Server must be running for live connection.\n`);
  }
  process.exit(0);
}, TEST_DURATION_MS);

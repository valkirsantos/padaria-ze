require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const http    = require("http");
const { WebSocketServer } = require("ws");

require("./database/db");

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });
const wsClients = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "auth" && msg.staffId) {
        wsClients.set(msg.staffId, ws);
        ws.send(JSON.stringify({ type: "auth_ok" }));
      }
    } catch {}
  });
  ws.on("close", () => {
    for (const [k, v] of wsClients.entries()) {
      if (v === ws) { wsClients.delete(k); break; }
    }
  });
});

function notificarStaff(padaria_id, payload) {
  const msg = JSON.stringify(payload);
  for (const [, ws] of wsClients.entries()) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}
app.locals.notificarStaff = notificarStaff;

app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || "http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

app.use("/api/auth",          require("./routes/auth"));
app.use("/api/produtos",      require("./routes/produtos"));
app.use("/api/pedidos",       require("./routes/pedidos"));
app.use("/api/configuracoes", require("./routes/configuracoes"));
app.use("/api/relatorios",    require("./routes/relatorios"));

app.get("/health", (req, res) => res.json({ status: "ok", env: process.env.NODE_ENV }));

app.use((err, req, res, next) => {
  console.error("Erro:", err.message);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Erro interno" : err.message });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(" Servidor rodando em http://localhost:" + PORT);
  console.log(" WebSocket disponivel em ws://localhost:" + PORT);
  console.log(" Ambiente: " + (process.env.NODE_ENV || "development"));
});

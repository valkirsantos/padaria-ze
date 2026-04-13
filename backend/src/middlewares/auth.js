const jwt = require("jsonwebtoken");
const db  = require("../database/db");

function extrairToken(req) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.split(" ")[1];
}

async function authCliente(req, res, next) {
  const token = extrairToken(req);
  if (!token) return res.status(401).json({ error: "Token nao fornecido" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipo !== "cliente") return res.status(403).json({ error: "Acesso negado" });
    const cliente = await db("clientes").where({ id: payload.id, ativo: true }).first();
    if (!cliente) return res.status(401).json({ error: "Cliente nao encontrado" });
    req.cliente = cliente;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Sessao expirada" });
    return res.status(401).json({ error: "Token invalido" });
  }
}

async function authStaff(req, res, next) {
  const token = extrairToken(req);
  if (!token) return res.status(401).json({ error: "Token nao fornecido" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipo !== "staff") return res.status(403).json({ error: "Acesso negado" });
    const staff = await db("staff").where({ id: payload.id, ativo: true }).first();
    if (!staff) return res.status(401).json({ error: "Usuario nao encontrado" });
    req.staff = staff;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Sessao expirada" });
    return res.status(401).json({ error: "Token invalido" });
  }
}

function authDono(req, res, next) {
  if (req.staff?.papel !== "dono") return res.status(403).json({ error: "Apenas o dono pode realizar esta acao" });
  next();
}

module.exports = { authCliente, authStaff, authDono };

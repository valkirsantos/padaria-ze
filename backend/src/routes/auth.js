const express   = require("express");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const db        = require("../database/db");
const { authCliente, authStaff } = require("../middlewares/auth");
const zapiService = require("../services/zapi");

const router = express.Router();

// Log de todas as requisições que chegam neste router
router.use((req, res, next) => {
  console.log(" Auth route:", req.method, req.path, JSON.stringify(req.body));
  next();
});

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/otp/enviar", async (req, res) => {
  try {
    const { telefone } = req.body;
    const tel = String(telefone || "").replace(/\D/g, "");
    console.log(" Enviando OTP para:", tel);
    if (tel.length < 10 || tel.length > 13) {
      return res.status(400).json({ error: "Numero de telefone invalido" });
    }
    const codigo = gerarCodigo();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db("otps").where({ telefone: tel, usado: false }).update({ usado: true });
    await db("otps").insert({ telefone: tel, codigo, expires_at: expiresAt });
    console.log(" OTP para " + tel + ": " + codigo);
    res.json({ message: "Codigo enviado", expira_em: expiresAt });
  } catch (err) {
    console.error("Erro ao enviar OTP:", err);
    res.status(500).json({ error: "Erro ao enviar codigo" });
  }
});

router.post("/otp/verificar", async (req, res) => {
  try {
    const { telefone, codigo } = req.body;
    const tel = String(telefone || "").replace(/\D/g, "");
    console.log(" Verificando OTP para:", tel, "codigo:", codigo);
    const otp = await db("otps")
      .where({ telefone: tel, codigo: String(codigo), usado: false })
      .where("expires_at", ">", new Date())
      .orderBy("created_at", "desc")
      .first();
    if (!otp) {
      console.log(" OTP invalido ou expirado para:", tel);
      return res.status(401).json({ error: "Codigo invalido ou expirado" });
    }
    await db("otps").where({ id: otp.id }).update({ usado: true });
    let cliente = await db("clientes").where({ telefone: tel }).first();
    const primeiro_acesso = !cliente;
    if (!cliente) {
      [cliente] = await db("clientes").insert({ telefone: tel, nome: "Cliente" }).returning("*");
      console.log(" Novo cliente criado:", cliente.id);
    } else {
      console.log(" Cliente existente:", cliente.id);
    }
    const token = jwt.sign(
      { id: cliente.id, tipo: "cliente" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    res.json({ token, cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone }, primeiro_acesso });
  } catch (err) {
    console.error("Erro ao verificar OTP:", err);
    res.status(500).json({ error: "Erro ao verificar codigo" });
  }
});

router.put("/perfil", authCliente, async (req, res) => {
  try {
    const { nome, endereco_rua, endereco_bairro, endereco_comp, preferencias, avatar_idx } = req.body;
    if (!nome || nome.trim().length < 2) return res.status(400).json({ error: "Nome invalido" });
    const [atualizado] = await db("clientes")
      .where({ id: req.cliente.id })
      .update({
        nome: nome.trim(),
        endereco_rua:    endereco_rua    || null,
        endereco_bairro: endereco_bairro || null,
        endereco_comp:   endereco_comp   || null,
        preferencias:    JSON.stringify(preferencias || []),
        avatar_idx:      avatar_idx !== undefined ? avatar_idx : 0,
        updated_at:      new Date(),
      })
      .returning(["id","nome","telefone","endereco_bairro","preferencias","avatar_idx"]);
    res.json({ cliente: atualizado });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

router.post("/staff/login", async (req, res) => {
  try {
    const { telefone, senha } = req.body;
    const tel = String(telefone || "").replace(/\D/g, "");
    console.log(" Login staff para:", tel);
    const staff = await db("staff").where({ telefone: tel, ativo: true }).first();
    console.log(" Staff encontrado:", staff ? staff.nome : "nao encontrado");
    const senhaCorreta = staff
      ? await bcrypt.compare(senha, staff.senha_hash)
      : await bcrypt.compare(senha, "$2b$10$invalido");
    if (!staff || !senhaCorreta) {
      console.log(" Login falhou para:", tel);
      return res.status(401).json({ error: "Telefone ou senha incorretos" });
    }
    const token = jwt.sign(
      { id: staff.id, tipo: "staff", padaria_id: staff.padaria_id, papel: staff.papel },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    console.log(" Login ok para:", staff.nome);
    res.json({ token, staff: { id: staff.id, nome: staff.nome, papel: staff.papel, padaria_id: staff.padaria_id } });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro ao realizar login" });
  }
});

router.get("/me/cliente", authCliente, (req, res) => {
  const { id, nome, telefone, endereco_rua, endereco_bairro, preferencias, avatar_idx } = req.cliente;
  res.json({ id, nome, telefone, endereco_rua, endereco_bairro, preferencias, avatar_idx });
});

router.get("/me/staff", authStaff, (req, res) => {
  const { id, nome, papel, padaria_id } = req.staff;
  res.json({ id, nome, papel, padaria_id });
});

module.exports = router;

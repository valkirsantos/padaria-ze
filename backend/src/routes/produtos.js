// backend/src/routes/produtos.js
const express = require("express");
const db      = require("../database/db");
const { authStaff, authDono } = require("../middlewares/auth");
const router  = express.Router();

// ─── GET /api/produtos/categorias ────────────────────────────────────────────
// IMPORTANTE: rota nomeada deve vir antes de /:id para o Express nao confundir
// Retorna apenas categorias que possuem ao menos 1 produto ativo e disponivel hoje
router.get("/categorias", async (req, res) => {
  try {
    const padaria = await db("padaria").first();
    if (!padaria) return res.json({ categorias: [] });

    const rows = await db("produtos")
      .where({ padaria_id: padaria.id, ativo: true, disponivel_hoje: true })
      .distinct("categoria")
      .select("categoria");

    // Ordena na ordem de exibicao desejada no catalogo
    const ORDEM = ["classicos", "especiais", "integrais", "doces", "outros"];
    const categorias = rows
      .map(r => r.categoria)
      .filter(Boolean)
      .sort((a, b) => {
        const ia = ORDEM.indexOf(a);
        const ib = ORDEM.indexOf(b);
        // Categorias nao mapeadas vao para o final
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

    res.json({ categorias });
  } catch (err) {
    console.error("Erro ao buscar categorias:", err);
    res.status(500).json({ error: "Erro ao buscar categorias" });
  }
});

// ─── GET /api/produtos — catálogo público ────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { categoria, busca } = req.query;
    const padaria = await db("padaria").first();
    if (!padaria) return res.status(404).json({ error: "Padaria nao encontrada" });
    const config = await db("configuracoes").where({ padaria_id: padaria.id }).first();
    const agora = new Date();
    const [hCorte, mCorte] = (config?.horario_corte || "20:00").split(":").map(Number);
    const dentroDoHorario = (agora.getHours() * 60 + agora.getMinutes()) < (hCorte * 60 + mCorte);
    let query = db("produtos")
      .where({ padaria_id: padaria.id, ativo: true, disponivel_hoje: true })
      .orderBy("ordem", "asc").orderBy("nome", "asc");
    if (categoria && categoria !== "todos") query = query.where({ categoria });
    if (busca) query = query.whereILike("nome", "%" + busca + "%");
    const produtos = await query.select(
      "id","nome","descricao","emoji","foto_url","categoria",
      "unidade","preco","estoque_max","badge","permite_delivery"
    );
    res.json({ produtos, catalogo_aberto: dentroDoHorario, horario_corte: config?.horario_corte || "20:00" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// ─── GET /api/produtos/admin ─────────────────────────────────────────────────
router.get("/admin", authStaff, async (req, res) => {
  try {
    const { categoria, busca } = req.query;
    let query = db("produtos")
      .where({ padaria_id: req.staff.padaria_id })
      .orderBy("ordem","asc").orderBy("nome","asc");
    if (categoria && categoria !== "todos") query = query.where({ categoria });
    if (busca) query = query.whereILike("nome", "%" + busca + "%");
    const produtos = await query;
    res.json({ produtos });
  } catch (err) { res.status(500).json({ error: "Erro ao buscar produtos" }); }
});

// ─── POST /api/produtos ───────────────────────────────────────────────────────
router.post("/", authStaff, authDono, async (req, res) => {
  try {
    const {
      nome, descricao, emoji, foto_url, categoria, unidade,
      preco, estoque_max, permite_delivery, alergenos, nota_producao, badge, ordem,
    } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: "Nome e obrigatorio" });
    if (!preco || preco < 0) return res.status(400).json({ error: "Preco invalido" });
    const [produto] = await db("produtos").insert({
      padaria_id:       req.staff.padaria_id,
      nome:             nome.trim(),
      descricao:        descricao?.trim() || null,
      emoji:            emoji || "🍞",
      foto_url:         foto_url || null,
      categoria:        categoria || "classicos",
      unidade:          unidade || "unidade",
      preco:            Number(preco),
      estoque_max:      estoque_max || 100,
      permite_delivery: permite_delivery !== false,
      alergenos:        alergenos || null,
      nota_producao:    nota_producao || null,
      badge:            badge || null,
      ordem:            ordem || 0,
    }).returning("*");
    res.status(201).json({ produto });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro ao criar produto" }); }
});

// ─── PUT /api/produtos/:id ────────────────────────────────────────────────────
router.put("/:id", authStaff, authDono, async (req, res) => {
  try {
    const { id } = req.params;
    const existe = await db("produtos").where({ id, padaria_id: req.staff.padaria_id }).first();
    if (!existe) return res.status(404).json({ error: "Produto nao encontrado" });
    const campos = [
      "nome","descricao","emoji","foto_url","categoria","unidade","preco",
      "estoque_max","ativo","disponivel_hoje","permite_delivery",
      "alergenos","nota_producao","badge","ordem",
    ];
    const updates = { updated_at: new Date() };
    campos.forEach(c => { if (req.body[c] !== undefined) updates[c] = req.body[c]; });
    if (updates.nome)  updates.nome  = updates.nome.trim();
    if (updates.preco) updates.preco = Number(updates.preco);
    const [atualizado] = await db("produtos").where({ id }).update(updates).returning("*");
    res.json({ produto: atualizado });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro ao atualizar produto" }); }
});

// ─── PATCH /api/produtos/:id/disponibilidade ──────────────────────────────────
router.patch("/:id/disponibilidade", authStaff, async (req, res) => {
  try {
    await db("produtos")
      .where({ id: req.params.id, padaria_id: req.staff.padaria_id })
      .update({ disponivel_hoje: Boolean(req.body.disponivel_hoje), updated_at: new Date() });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erro ao atualizar disponibilidade" }); }
});

// ─── DELETE /api/produtos/:id ─────────────────────────────────────────────────
router.delete("/:id", authStaff, authDono, async (req, res) => {
  try {
    const atualizado = await db("produtos")
      .where({ id: req.params.id, padaria_id: req.staff.padaria_id })
      .update({ ativo: false, disponivel_hoje: false, updated_at: new Date() });
    if (!atualizado) return res.status(404).json({ error: "Produto nao encontrado" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erro ao desativar produto" }); }
});

module.exports = router;

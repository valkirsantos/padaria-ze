const express = require("express");
const db      = require("../database/db");
const { authStaff, authDono } = require("../middlewares/auth");
const router  = express.Router();

router.get("/", authStaff, async (req, res) => {
  try {
    const config  = await db("configuracoes").where({ padaria_id: req.staff.padaria_id }).first();
    const padaria = await db("padaria").where({ id: req.staff.padaria_id }).first();
    res.json({ config, padaria });
  } catch (err) { res.status(500).json({ error: "Erro ao buscar configuracoes" }); }
});

router.put("/", authStaff, authDono, async (req, res) => {
  try {
    const campos = ["horario_abertura","horario_fechamento","horario_corte","horario_aviso_corte",
                    "pedido_minimo","aceita_delivery","raio_delivery_km","aceita_pix",
                    "aceita_cartao","aceita_dinheiro","pix_chave","pix_tipo"];
    const updates = { updated_at: new Date() };
    campos.forEach(c => { if (req.body[c] !== undefined) updates[c] = req.body[c]; });
    if (req.body.taxas_delivery !== undefined) updates.taxas_delivery = JSON.stringify(req.body.taxas_delivery);
    const [config] = await db("configuracoes").where({ padaria_id: req.staff.padaria_id }).update(updates).returning("*");
    res.json({ config });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro ao atualizar configuracoes" }); }
});

module.exports = router;

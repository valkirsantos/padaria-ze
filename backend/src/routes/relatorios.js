const express = require("express");
const db      = require("../database/db");
const { authStaff } = require("../middlewares/auth");
const router  = express.Router();

function periodo(p) {
  const hoje = new Date();
  const fim  = new Date(hoje); fim.setHours(23,59,59,999);
  let inicio;
  if      (p === "semana")    { inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 6); }
  else if (p === "trimestre") { inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 89); }
  else                        { inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); }
  inicio.setHours(0,0,0,0);
  return { inicio: inicio.toISOString().split("T")[0], fim: fim.toISOString().split("T")[0] };
}

router.get("/faturamento", authStaff, async (req, res) => {
  try {
    const { inicio, fim } = periodo(req.query.periodo || "mes");
    const porDia = await db("pedidos").where({ padaria_id: req.staff.padaria_id })
      .whereBetween("data_entrega", [inicio, fim]).whereNotIn("status", ["cancelado"])
      .select(db.raw("data_entrega, SUM(total) as faturamento, COUNT(*) as pedidos"))
      .groupBy("data_entrega").orderBy("data_entrega","asc");
    const totais = await db("pedidos").where({ padaria_id: req.staff.padaria_id })
      .whereBetween("data_entrega", [inicio, fim]).whereNotIn("status", ["cancelado"])
      .select(db.raw("SUM(total) as faturamento_total, COUNT(*) as total_pedidos, COUNT(DISTINCT cliente_id) as clientes_unicos, AVG(total) as ticket_medio"))
      .first();
    const pagamentos = await db("pedidos as p").join("pagamentos as pg","p.id","pg.pedido_id")
      .where({ "p.padaria_id": req.staff.padaria_id }).whereBetween("p.data_entrega", [inicio, fim])
      .whereNotIn("p.status", ["cancelado"])
      .select(db.raw("pg.metodo, COUNT(*) as qtd, SUM(p.total) as valor")).groupBy("pg.metodo");
    res.json({ porDia, totais, pagamentos, periodo: { inicio, fim } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro no relatorio" }); }
});

router.get("/produtos", authStaff, async (req, res) => {
  try {
    const { inicio, fim } = periodo(req.query.periodo || "mes");
    const ranking = await db("itens_pedido as ip")
      .join("pedidos as p","ip.pedido_id","p.id").join("produtos as pr","ip.produto_id","pr.id")
      .where({ "p.padaria_id": req.staff.padaria_id }).whereBetween("p.data_entrega", [inicio, fim])
      .whereNotIn("p.status", ["cancelado"])
      .select("pr.id","pr.nome","pr.emoji", db.raw("SUM(ip.quantidade) as total_unidades, SUM(ip.subtotal) as faturamento"))
      .groupBy("pr.id","pr.nome","pr.emoji").orderBy("total_unidades","desc").limit(10);
    res.json({ ranking, periodo: { inicio, fim } });
  } catch (err) { res.status(500).json({ error: "Erro no relatorio de produtos" }); }
});

router.get("/inadimplencia", authStaff, async (req, res) => {
  try {
    const trintaDias = new Date(); trintaDias.setDate(trintaDias.getDate() - 30);
    const lista = await db("pedidos as p").join("clientes as c","p.cliente_id","c.id")
      .join("pagamentos as pg","p.id","pg.pedido_id")
      .where({ "p.padaria_id": req.staff.padaria_id, "pg.status": "pendente" })
      .where("p.data_entrega",">=", trintaDias.toISOString().split("T")[0])
      .whereNotIn("p.status", ["cancelado"]).orderBy("p.data_entrega","asc")
      .select("p.id","p.numero","p.total","p.data_entrega","c.nome as cliente_nome","c.telefone as cliente_tel");
    res.json({ inadimplentes: lista, total_aberto: lista.reduce((s,p) => s + Number(p.total), 0) });
  } catch (err) { res.status(500).json({ error: "Erro no relatorio de inadimplencia" }); }
});

router.get("/entregas", authStaff, async (req, res) => {
  try {
    const { inicio, fim } = periodo(req.query.periodo || "mes");
    const porTipo = await db("pedidos").where({ padaria_id: req.staff.padaria_id })
      .whereBetween("data_entrega", [inicio, fim]).whereNotIn("status", ["cancelado"])
      .select(db.raw("tipo_entrega, COUNT(*) as qtd")).groupBy("tipo_entrega");
    const porDia  = await db("pedidos").where({ padaria_id: req.staff.padaria_id })
      .whereBetween("data_entrega", [inicio, fim]).whereNotIn("status", ["cancelado"])
      .select(db.raw("data_entrega, COUNT(*) FILTER (WHERE tipo_entrega = 'retirada') as retiradas, COUNT(*) FILTER (WHERE tipo_entrega = 'delivery') as deliveries"))
      .groupBy("data_entrega").orderBy("data_entrega","asc");
    res.json({ porTipo, porDia, periodo: { inicio, fim } });
  } catch (err) { res.status(500).json({ error: "Erro no relatorio de entregas" }); }
});

module.exports = router;

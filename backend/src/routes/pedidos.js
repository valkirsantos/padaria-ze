const express = require("express");
const db      = require("../database/db");
const { authCliente, authStaff } = require("../middlewares/auth");
const router  = express.Router();

function calcularDataEntrega() {
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return amanha.toISOString().split("T")[0];
}

async function proximoNumero(padaria_id, data_entrega) {
  const r = await db("pedidos").where({ padaria_id, data_entrega }).max("numero as max").first();
  return (r?.max || 0) + 1;
}

// POST /api/pedidos
router.post("/", authCliente, async (req, res) => {
  const trx = await db.transaction();
  try {
    const { itens, tipo_entrega, endereco_entrega, bairro_entrega, comp_entrega, observacao } = req.body;
    if (!itens || !itens.length) return res.status(400).json({ error: "O pedido deve ter ao menos um item" });
    if (!["retirada","delivery"].includes(tipo_entrega)) return res.status(400).json({ error: "Tipo de entrega invalido" });
    if (tipo_entrega === "delivery" && !endereco_entrega) return res.status(400).json({ error: "Endereco obrigatorio para delivery" });

    const padaria = await trx("padaria").first();
    const config  = await trx("configuracoes").where({ padaria_id: padaria.id }).first();

    // Em desenvolvimento, nao verifica horario de corte para facilitar testes
    if (process.env.NODE_ENV !== "development") {
      const agora = new Date();
      const [hC, mC] = (config?.horario_corte || "20:00").split(":").map(Number);
      if ((agora.getHours() * 60 + agora.getMinutes()) >= (hC * 60 + mC)) {
        await trx.rollback();
        return res.status(400).json({ error: "Pedidos encerrados. Horario de corte: " + config.horario_corte });
      }
    }

    const ids = itens.map(i => i.produto_id);
    const produtos = await trx("produtos").whereIn("id", ids).where({ padaria_id: padaria.id, ativo: true });
    const prodMap  = new Map(produtos.map(p => [p.id, p]));

    let subtotal = 0;
    const itensVal = [];
    for (const item of itens) {
      const p = prodMap.get(item.produto_id);
      if (!p) { await trx.rollback(); return res.status(400).json({ error: "Produto nao encontrado: " + item.produto_id }); }
      if (!item.quantidade || item.quantidade < 1) { await trx.rollback(); return res.status(400).json({ error: "Quantidade invalida" }); }
      const sub = Number(p.preco) * item.quantidade;
      subtotal += sub;
      itensVal.push({ produto_id: p.id, quantidade: item.quantidade, preco_unitario: Number(p.preco), subtotal: sub });
    }

    const taxas = config?.taxas_delivery ? (typeof config.taxas_delivery === "string" ? JSON.parse(config.taxas_delivery) : config.taxas_delivery) : {};
    const taxa_delivery = tipo_entrega === "delivery" ? (Number(taxas[bairro_entrega]) || Number(taxas["Outros"]) || 0) : 0;
    const total = subtotal + taxa_delivery;

    const data_entrega = calcularDataEntrega();
    const numero = await proximoNumero(padaria.id, data_entrega);

    const [pedido] = await trx("pedidos").insert({
      padaria_id: padaria.id, cliente_id: req.cliente.id, numero,
      tipo_entrega, endereco_entrega: endereco_entrega || null,
      bairro_entrega: bairro_entrega || null, comp_entrega: comp_entrega || null,
      status: "aguardando", subtotal, taxa_delivery, total, data_entrega,
      observacao: observacao || null,
    }).returning("*");

    await trx("itens_pedido").insert(itensVal.map(i => ({ ...i, pedido_id: pedido.id })));
    await trx("pagamentos").insert({ pedido_id: pedido.id, metodo: "pendente", status: "pendente", valor: total });
    await trx.commit();

    console.log(" Pedido criado:", pedido.numero, "data_entrega:", data_entrega);

    const notificar = req.app.locals.notificarStaff;
    if (notificar) notificar(padaria.id, { type: "novo_pedido", pedido: { id: pedido.id, numero, total, tipo_entrega } });

    res.status(201).json({ pedido: { ...pedido, itens: itensVal } });
  } catch (err) {
    await trx.rollback();
    console.error("Erro ao criar pedido:", err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// GET /api/pedidos/meus
router.get("/meus", authCliente, async (req, res) => {
  try {
    const pedidos = await db("pedidos").where({ cliente_id: req.cliente.id })
      .orderBy("created_at","desc").limit(20)
      .select("id","numero","status","total","tipo_entrega","data_entrega","created_at");
    res.json({ pedidos });
  } catch (err) { res.status(500).json({ error: "Erro ao buscar pedidos" }); }
});

// GET /api/pedidos/dia
// Retorna pedidos de hoje E amanha  util durante desenvolvimento e no dia operacional
router.get("/dia", authStaff, async (req, res) => {
  try {
    const { data, status, tipo_entrega } = req.query;

    let dataFiltro = data;
    if (!dataFiltro) {
      // Se nao vier data, busca pedidos dos proximos 2 dias
      // Cobre o caso de pedidos feitos hoje (data_entrega = amanha)
      const hoje   = new Date().toISOString().split("T")[0];
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      let query = db("pedidos as p")
        .join("clientes as c",       "p.cliente_id", "c.id")
        .leftJoin("pagamentos as pg", "p.id",         "pg.pedido_id")
        .where({ "p.padaria_id": req.staff.padaria_id })
        .whereIn("p.data_entrega", [hoje, amanha])
        .orderBy("p.data_entrega","asc")
        .orderBy("p.numero","asc");

      if (status)       query = query.where("p.status", status);
      if (tipo_entrega) query = query.where("p.tipo_entrega", tipo_entrega);

      const pedidos = await query.select(
        "p.id","p.numero","p.status","p.tipo_entrega","p.subtotal","p.taxa_delivery","p.total",
        "p.endereco_entrega","p.bairro_entrega","p.data_entrega","p.observacao","p.created_at",
        "c.id as cliente_id","c.nome as cliente_nome","c.telefone as cliente_tel",
        "pg.metodo as pag_metodo","pg.status as pag_status"
      );

      const pedidoIds = pedidos.map(p => p.id);
      const itens = pedidoIds.length > 0
        ? await db("itens_pedido as ip").join("produtos as pr","ip.produto_id","pr.id")
            .whereIn("ip.pedido_id", pedidoIds)
            .select("ip.pedido_id","ip.quantidade","ip.preco_unitario","ip.subtotal","pr.nome","pr.emoji")
        : [];

      const itensPor = itens.reduce((a, i) => {
        if (!a[i.pedido_id]) a[i.pedido_id] = [];
        a[i.pedido_id].push(i);
        return a;
      }, {});

      const metricas = {
        total_pedidos:  pedidos.length,
        total_faturado: pedidos.reduce((s, p) => s + Number(p.total), 0),
        pagos:          pedidos.filter(p => p.pag_status === "pago").length,
        pendentes:      pedidos.filter(p => p.pag_status === "pendente").length,
      };

      console.log(" Pedidos retornados:", pedidos.length, "datas:", [hoje, amanha]);
      return res.json({ pedidos: pedidos.map(p => ({ ...p, itens: itensPor[p.id] || [] })), metricas, data: hoje });
    }

    // Busca por data especifica (quando o parametro ?data= e passado)
    let query = db("pedidos as p")
      .join("clientes as c",       "p.cliente_id", "c.id")
      .leftJoin("pagamentos as pg", "p.id",         "pg.pedido_id")
      .where({ "p.padaria_id": req.staff.padaria_id, "p.data_entrega": dataFiltro })
      .orderBy("p.numero","asc");

    if (status)       query = query.where("p.status", status);
    if (tipo_entrega) query = query.where("p.tipo_entrega", tipo_entrega);

    const pedidos = await query.select(
      "p.id","p.numero","p.status","p.tipo_entrega","p.subtotal","p.taxa_delivery","p.total",
      "p.endereco_entrega","p.bairro_entrega","p.data_entrega","p.observacao","p.created_at",
      "c.id as cliente_id","c.nome as cliente_nome","c.telefone as cliente_tel",
      "pg.metodo as pag_metodo","pg.status as pag_status"
    );

    const pedidoIds = pedidos.map(p => p.id);
    const itens = pedidoIds.length > 0
      ? await db("itens_pedido as ip").join("produtos as pr","ip.produto_id","pr.id")
          .whereIn("ip.pedido_id", pedidoIds)
          .select("ip.pedido_id","ip.quantidade","ip.preco_unitario","ip.subtotal","pr.nome","pr.emoji")
      : [];

    const itensPor = itens.reduce((a, i) => {
      if (!a[i.pedido_id]) a[i.pedido_id] = [];
      a[i.pedido_id].push(i);
      return a;
    }, {});

    const metricas = {
      total_pedidos:  pedidos.length,
      total_faturado: pedidos.reduce((s, p) => s + Number(p.total), 0),
      pagos:          pedidos.filter(p => p.pag_status === "pago").length,
      pendentes:      pedidos.filter(p => p.pag_status === "pendente").length,
    };

    res.json({ pedidos: pedidos.map(p => ({ ...p, itens: itensPor[p.id] || [] })), metricas, data: dataFiltro });
  } catch (err) {
    console.error("Erro ao buscar pedidos do dia:", err);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

// PUT /api/pedidos/:id/status
router.put("/:id/status", authStaff, async (req, res) => {
  try {
    const validos = ["aguardando","pronto","entregue","cancelado"];
    if (!validos.includes(req.body.status)) return res.status(400).json({ error: "Status invalido" });
    const [pedido] = await db("pedidos").where({ id: req.params.id, padaria_id: req.staff.padaria_id })
      .update({ status: req.body.status, updated_at: new Date() }).returning("*");
    if (!pedido) return res.status(404).json({ error: "Pedido nao encontrado" });
    res.json({ pedido });
  } catch (err) { res.status(500).json({ error: "Erro ao atualizar status" }); }
});

// PUT /api/pedidos/:id/pagamento
router.put("/:id/pagamento", authStaff, async (req, res) => {
  try {
    const validos = ["cartao_credito","cartao_debito","dinheiro"];
    if (!validos.includes(req.body.metodo)) return res.status(400).json({ error: "Metodo invalido" });
    const pedido = await db("pedidos").where({ id: req.params.id, padaria_id: req.staff.padaria_id }).first();
    if (!pedido) return res.status(404).json({ error: "Pedido nao encontrado" });
    const [pagamento] = await db("pagamentos").where({ pedido_id: req.params.id })
      .update({ metodo: req.body.metodo, status: "pago", pago_em: new Date(), updated_at: new Date() }).returning("*");
    res.json({ pagamento });
  } catch (err) { res.status(500).json({ error: "Erro ao registrar pagamento" }); }
});

// GET /api/pedidos/:id
router.get("/:id", authCliente, async (req, res) => {
  try {
    const pedido = await db("pedidos as p").leftJoin("pagamentos as pg","p.id","pg.pedido_id")
      .where({ "p.id": req.params.id, "p.cliente_id": req.cliente.id })
      .select("p.*","pg.metodo as pag_metodo","pg.status as pag_status").first();
    if (!pedido) return res.status(404).json({ error: "Pedido nao encontrado" });
    const itens = await db("itens_pedido as ip").join("produtos as pr","ip.produto_id","pr.id")
      .where({ "ip.pedido_id": pedido.id }).select("ip.*","pr.nome","pr.emoji");
    res.json({ pedido: { ...pedido, itens } });
  } catch (err) { res.status(500).json({ error: "Erro ao buscar pedido" }); }
});

module.exports = router;

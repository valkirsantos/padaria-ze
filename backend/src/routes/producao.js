// backend/src/routes/producao.js
// GET /api/producao/dia  — retorna a ordem de producao consolidada
// PUT /api/producao/status — atualiza o status geral da producao

const express = require("express");
const db      = require("../database/db");
const { authStaff } = require("../middlewares/auth");
const router  = express.Router();

// GET /api/producao/dia
// Consolida todos os pedidos de hoje e amanha em quantitativos por produto
router.get("/dia", authStaff, async (req, res) => {
  try {
    const { data } = req.query;

    const hoje   = new Date().toISOString().split("T")[0];
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const datas  = data ? [data] : [hoje, amanha];

    // Busca todos os pedidos ativos das datas selecionadas
    const pedidos = await db("pedidos as p")
      .join("clientes as c", "p.cliente_id", "c.id")
      .leftJoin("pagamentos as pg", "p.id", "pg.pedido_id")
      .where({ "p.padaria_id": req.staff.padaria_id })
      .whereIn("p.data_entrega", datas)
      .whereNotIn("p.status", ["cancelado"])
      .orderBy("p.numero", "asc")
      .select(
        "p.id", "p.numero", "p.tipo_entrega", "p.status", "p.data_entrega",
        "p.endereco_entrega", "p.bairro_entrega", "p.total",
        "c.nome as cliente_nome", "c.telefone as cliente_tel",
        "pg.status as pag_status", "pg.metodo as pag_metodo"
      );

    if (pedidos.length === 0) {
      return res.json({
        quantitativos: [],
        deliveries:    [],
        retiradas:     [],
        total_pedidos: 0,
        total_unidades: 0,
        datas,
        status_producao: "aguardando",
      });
    }

    const pedidoIds = pedidos.map(p => p.id);

    // Busca todos os itens dos pedidos em uma única query
    const itens = await db("itens_pedido as ip")
      .join("produtos as pr", "ip.produto_id", "pr.id")
      .whereIn("ip.pedido_id", pedidoIds)
      .select(
        "ip.pedido_id", "ip.quantidade", "ip.preco_unitario", "ip.subtotal",
        "pr.id as produto_id", "pr.nome", "pr.emoji", "pr.categoria",
        "pr.unidade", "pr.alergenos", "pr.nota_producao"
      );

    // Consolida quantitativos por produto
    const mapa = new Map();
    for (const item of itens) {
      const key = item.produto_id;
      if (!mapa.has(key)) {
        mapa.set(key, {
          produto_id:    item.produto_id,
          nome:          item.nome,
          emoji:         item.emoji,
          categoria:     item.categoria,
          unidade:       item.unidade,
          alergenos:     item.alergenos,
          nota_producao: item.nota_producao,
          quantidade:    0,
          faturamento:   0,
          concluido:     false, // checklist do padeiro
        });
      }
      const prod = mapa.get(key);
      prod.quantidade  += Number(item.quantidade);
      prod.faturamento += Number(item.subtotal);
    }

    // Ordena por categoria e depois por nome
    const ORDEM_CAT = { classicos:0, especiais:1, integrais:2, doces:3, outros:4 };
    const quantitativos = [...mapa.values()].sort((a, b) => {
      const oa = ORDEM_CAT[a.categoria] ?? 9;
      const ob = ORDEM_CAT[b.categoria] ?? 9;
      return oa !== ob ? oa - ob : a.nome.localeCompare(b.nome);
    });

    // Separa deliveries e retiradas para o padeiro identificar os sacos
    const itensPorPedido = itens.reduce((acc, i) => {
      if (!acc[i.pedido_id]) acc[i.pedido_id] = [];
      acc[i.pedido_id].push(i);
      return acc;
    }, {});

    const deliveries = pedidos
      .filter(p => p.tipo_entrega === "delivery")
      .map(p => ({
        ...p,
        itens: itensPorPedido[p.id] || [],
      }));

    const retiradas = pedidos
      .filter(p => p.tipo_entrega === "retirada")
      .map(p => ({
        ...p,
        itens: itensPorPedido[p.id] || [],
      }));

    const total_unidades = quantitativos.reduce((s, q) => s + q.quantidade, 0);

    // Observacoes especiais: pedidos com alergenos
    const observacoes = [];
    for (const item of itens) {
      if (item.alergenos) {
        const pedido = pedidos.find(p => p.id === item.pedido_id);
        if (pedido) {
          observacoes.push({
            cliente: pedido.cliente_nome,
            produto: item.nome,
            alergeno: item.alergenos,
          });
        }
      }
      if (item.nota_producao && !observacoes.find(o => o.produto === item.nome && o.nota === item.nota_producao)) {
        observacoes.push({
          produto: item.nome,
          nota: item.nota_producao,
        });
      }
    }

    res.json({
      quantitativos,
      deliveries,
      retiradas,
      observacoes,
      total_pedidos:  pedidos.length,
      total_unidades,
      datas,
      status_producao: "aguardando",
    });
  } catch (err) {
    console.error("Erro ao gerar ordem de producao:", err);
    res.status(500).json({ error: "Erro ao gerar ordem de producao" });
  }
});

module.exports = router;

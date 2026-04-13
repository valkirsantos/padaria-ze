// backend/src/routes/pedidos.js
// Rotas de pedidos:
//   POST /api/pedidos                    — cliente cria pedido
//   GET  /api/pedidos/meus              — pedidos do cliente logado
//   GET  /api/pedidos/dia               — todos os pedidos do dia (dono)
//   PUT  /api/pedidos/:id/status        — atualiza status (dono)
//   PUT  /api/pedidos/:id/pagamento     — registra pagamento manual (dono)
//   GET  /api/pedidos/:id               — detalhe de um pedido

const express = require('express');
const db      = require('../database/db');
const { authCliente, authStaff } = require('../middlewares/auth');

const router = express.Router();

// ─── Funções auxiliares ───────────────────────────────────────────────────────

// Calcula o próximo número sequencial do pedido para o dia
async function proximoNumeroPedido(padaria_id, data_entrega) {
  const result = await db('pedidos')
    .where({ padaria_id, data_entrega })
    .max('numero as max')
    .first();
  return (result?.max || 0) + 1;
}

// Calcula a data de entrega (amanhã) no fuso de Brasília
function calcularDataEntrega() {
  const agora = new Date();
  // Adiciona 1 dia para pedidos feitos em qualquer horário
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  return amanha.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

// ─── POST /api/pedidos — criar pedido ─────────────────────────────────────────
router.post('/', authCliente, async (req, res) => {
  const trx = await db.transaction(); // transação: ou tudo salva, ou nada

  try {
    const { itens, tipo_entrega, endereco_entrega, bairro_entrega, comp_entrega, observacao } = req.body;

    // Validações básicas
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'O pedido deve ter ao menos um item' });
    }
    if (!['retirada', 'delivery'].includes(tipo_entrega)) {
      return res.status(400).json({ error: 'Tipo de entrega inválido' });
    }
    if (tipo_entrega === 'delivery' && !endereco_entrega) {
      return res.status(400).json({ error: 'Endereço obrigatório para delivery' });
    }

    // Busca a padaria e suas configurações
    const padaria = await trx('padaria').first();
    const config  = await trx('configuracoes').where({ padaria_id: padaria.id }).first();

    // Verifica horário de corte
    const agora = new Date();
    const [hCorte, mCorte] = (config?.horario_corte || '20:00').split(':').map(Number);
    const corteMinutos  = hCorte * 60 + mCorte;
    const agoraMinutos  = agora.getHours() * 60 + agora.getMinutes();
    if (agoraMinutos >= corteMinutos) {
      await trx.rollback();
      return res.status(400).json({
        error: `Pedidos encerrados para hoje. Horário de corte: ${config.horario_corte}`,
      });
    }

    // Busca os produtos solicitados e valida preços/disponibilidade
    const ids = itens.map(i => i.produto_id);
    const produtos = await trx('produtos')
      .whereIn('id', ids)
      .where({ padaria_id: padaria.id, ativo: true, disponivel_hoje: true });

    const produtosMap = new Map(produtos.map(p => [p.id, p]));

    let subtotal = 0;
    const itensValidados = [];

    for (const item of itens) {
      const produto = produtosMap.get(item.produto_id);
      if (!produto) {
        await trx.rollback();
        return res.status(400).json({ error: `Produto ${item.produto_id} não disponível` });
      }
      if (!item.quantidade || item.quantidade < 1) {
        await trx.rollback();
        return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
      }
      // Usa o preço do banco, não do cliente — evita manipulação de preço
      const itemSubtotal = produto.preco * item.quantidade;
      subtotal += itemSubtotal;
      itensValidados.push({
        produto_id:     produto.id,
        quantidade:     item.quantidade,
        preco_unitario: produto.preco,
        subtotal:       itemSubtotal,
      });
    }

    // Calcula taxa de delivery
    let taxa_delivery = 0;
    if (tipo_entrega === 'delivery') {
      const taxas = config?.taxas_delivery || {};
      taxa_delivery = taxas[bairro_entrega] || taxas['Outros'] || 0;
    }

    const total = subtotal + taxa_delivery;

    // Verifica pedido mínimo
    if (config?.pedido_minimo && total < config.pedido_minimo) {
      await trx.rollback();
      return res.status(400).json({
        error: `Pedido mínimo é R$ ${Number(config.pedido_minimo).toFixed(2).replace('.', ',')}`,
      });
    }

    const data_entrega = calcularDataEntrega();
    const numero = await proximoNumeroPedido(padaria.id, data_entrega);

    // Cria o pedido
    const [pedido] = await trx('pedidos').insert({
      padaria_id:       padaria.id,
      cliente_id:       req.cliente.id,
      numero,
      tipo_entrega,
      endereco_entrega: endereco_entrega || null,
      bairro_entrega:   bairro_entrega   || null,
      comp_entrega:     comp_entrega     || null,
      status:           'aguardando',
      subtotal,
      taxa_delivery,
      total,
      data_entrega,
      observacao: observacao || null,
    }).returning('*');

    // Insere os itens
    await trx('itens_pedido').insert(
      itensValidados.map(i => ({ ...i, pedido_id: pedido.id }))
    );

    // Cria registro de pagamento inicial como pendente
    await trx('pagamentos').insert({
      pedido_id: pedido.id,
      metodo:    'pendente',
      status:    'pendente',
      valor:     total,
    });

    // Confirma a transação
    await trx.commit();

    // Notifica o dono via WebSocket (não bloqueia a resposta ao cliente)
    const notificar = req.app.locals.notificarStaff;
    if (notificar) {
      notificar(padaria.id, {
        type:   'novo_pedido',
        pedido: { id: pedido.id, numero: pedido.numero, total: pedido.total, tipo_entrega },
      });
    }

    res.status(201).json({ pedido: { ...pedido, itens: itensValidados } });
  } catch (err) {
    await trx.rollback();
    console.error('Erro ao criar pedido:', err);
    res.status(500).json({ error: 'Erro ao criar pedido' });
  }
});

// ─── GET /api/pedidos/meus — pedidos do cliente logado ────────────────────────
router.get('/meus', authCliente, async (req, res) => {
  try {
    const pedidos = await db('pedidos')
      .where({ cliente_id: req.cliente.id })
      .orderBy('created_at', 'desc')
      .limit(20) // últimos 20 pedidos
      .select('id','numero','status','total','tipo_entrega','data_entrega','created_at');

    res.json({ pedidos });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// ─── GET /api/pedidos/dia — painel do dono ────────────────────────────────────
router.get('/dia', authStaff, async (req, res) => {
  try {
    const { data, status, tipo_entrega } = req.query;

    // Padrão: pedidos de hoje ou da data especificada
    const dataFiltro = data || new Date().toISOString().split('T')[0];

    let query = db('pedidos as p')
      .join('clientes as c', 'p.cliente_id', 'c.id')
      .leftJoin('pagamentos as pg', 'p.id', 'pg.pedido_id')
      .where({
        'p.padaria_id':  req.staff.padaria_id,
        'p.data_entrega': dataFiltro,
      })
      .orderBy('p.numero', 'asc');

    if (status)       query = query.where('p.status', status);
    if (tipo_entrega) query = query.where('p.tipo_entrega', tipo_entrega);

    const pedidos = await query.select(
      'p.id', 'p.numero', 'p.status', 'p.tipo_entrega',
      'p.subtotal', 'p.taxa_delivery', 'p.total',
      'p.endereco_entrega', 'p.bairro_entrega',
      'p.observacao', 'p.created_at',
      'c.id as cliente_id', 'c.nome as cliente_nome', 'c.telefone as cliente_tel',
      'pg.metodo as pag_metodo', 'pg.status as pag_status',
    );

    // Busca itens dos pedidos em uma única query (evita N+1)
    const pedidoIds = pedidos.map(p => p.id);
    const itens = pedidoIds.length > 0
      ? await db('itens_pedido as ip')
          .join('produtos as pr', 'ip.produto_id', 'pr.id')
          .whereIn('ip.pedido_id', pedidoIds)
          .select('ip.pedido_id','ip.quantidade','ip.preco_unitario','ip.subtotal',
                  'pr.nome','pr.emoji')
      : [];

    // Agrupa itens por pedido_id para montar a estrutura final
    const itensPorPedido = itens.reduce((acc, item) => {
      if (!acc[item.pedido_id]) acc[item.pedido_id] = [];
      acc[item.pedido_id].push(item);
      return acc;
    }, {});

    const resultado = pedidos.map(p => ({
      ...p,
      itens: itensPorPedido[p.id] || [],
    }));

    // Métricas resumidas do dia
    const metricas = {
      total_pedidos:  pedidos.length,
      total_faturado: pedidos.reduce((sum, p) => sum + Number(p.total), 0),
      pagos:          pedidos.filter(p => p.pag_status === 'pago').length,
      pendentes:      pedidos.filter(p => p.pag_status === 'pendente').length,
    };

    res.json({ pedidos: resultado, metricas, data: dataFiltro });
  } catch (err) {
    console.error('Erro ao buscar pedidos do dia:', err);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// ─── PUT /api/pedidos/:id/status — atualiza status ────────────────────────────
router.put('/:id/status', authStaff, async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const statusValidos = ['aguardando', 'pronto', 'entregue', 'cancelado'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const [pedido] = await db('pedidos')
      .where({ id, padaria_id: req.staff.padaria_id })
      .update({ status, updated_at: new Date() })
      .returning('*');

    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    res.json({ pedido });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// ─── PUT /api/pedidos/:id/pagamento — registra pagamento manual ───────────────
router.put('/:id/pagamento', authStaff, async (req, res) => {
  try {
    const { id }     = req.params;
    const { metodo } = req.body; // 'cartao_credito', 'cartao_debito', 'dinheiro'

    const metodosValidos = ['cartao_credito', 'cartao_debito', 'dinheiro', 'pendente'];
    if (!metodosValidos.includes(metodo)) {
      return res.status(400).json({ error: 'Método de pagamento inválido' });
    }

    // Verifica que o pedido pertence à padaria
    const pedido = await db('pedidos')
      .where({ id, padaria_id: req.staff.padaria_id })
      .first();
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    // Se metodo for 'pendente', reverte o pagamento para nao pago
    const ehReversao = metodo === 'pendente';
    const [pagamento] = await db('pagamentos')
      .where({ pedido_id: id })
      .update({
        metodo,
        status:  ehReversao ? 'pendente' : 'pago',
        pago_em: ehReversao ? null : new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    res.json({ pagamento });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

// ─── GET /api/pedidos/:id — detalhe ──────────────────────────────────────────
router.get('/:id', authCliente, async (req, res) => {
  try {
    const pedido = await db('pedidos as p')
      .leftJoin('pagamentos as pg', 'p.id', 'pg.pedido_id')
      .where({ 'p.id': req.params.id, 'p.cliente_id': req.cliente.id })
      .select('p.*', 'pg.metodo as pag_metodo', 'pg.status as pag_status')
      .first();

    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    const itens = await db('itens_pedido as ip')
      .join('produtos as pr', 'ip.produto_id', 'pr.id')
      .where({ 'ip.pedido_id': pedido.id })
      .select('ip.*', 'pr.nome', 'pr.emoji');

    res.json({ pedido: { ...pedido, itens } });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

module.exports = router;

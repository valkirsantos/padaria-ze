const bcrypt = require("bcryptjs");

exports.seed = async function(knex) {
  await knex("otps").del();
  await knex("pagamentos").del();
  await knex("itens_pedido").del();
  await knex("pedidos").del();
  await knex("produtos").del();
  await knex("configuracoes").del();
  await knex("staff").del();
  await knex("clientes").del();
  await knex("padaria").del();

  const [padaria] = await knex("padaria").insert({
    nome: "Padaria do Ze",
    telefone: "(93) 98800-1234",
    endereco: "Rua das Flores, 100",
    cidade: "Santarem",
    estado: "PA",
  }).returning("*");

  const senhaHash = await bcrypt.hash("admin123", 10);
  await knex("staff").insert({
    padaria_id: padaria.id,
    nome: "Ze",
    telefone: "93988001234",
    senha_hash: senhaHash,
    papel: "dono",
  });

  await knex("configuracoes").insert({
    padaria_id:        padaria.id,
    horario_abertura:  "07:00",
    horario_fechamento:"12:00",
    horario_corte:     "20:00",
    pedido_minimo:     5.00,
    aceita_delivery:   true,
    taxas_delivery:    JSON.stringify({ Centro: 3, Aparecida: 5, Aldeia: 7, Outros: 8 }),
    aceita_pix:        true,
    aceita_cartao:     true,
    pix_chave:         "93988001234",
    pix_tipo:          "celular",
  });

  await knex("produtos").insert([
    { padaria_id: padaria.id, nome: "Pao frances",   descricao: "Crocante por fora, macio por dentro", emoji: "", categoria: "classicos",  preco: 0.75, estoque_max: 200, badge: "destaque", ordem: 1 },
    { padaria_id: padaria.id, nome: "Pao de queijo", descricao: "Receita mineira tradicional",          emoji: "", categoria: "especiais",  preco: 2.50, estoque_max: 80,  badge: "novo",     ordem: 2 },
    { padaria_id: padaria.id, nome: "Croissant",     descricao: "Massa folhada amanteigada",            emoji: "", categoria: "doces",      preco: 6.50, estoque_max: 40,  badge: "destaque", ordem: 3 },
    { padaria_id: padaria.id, nome: "Pao integral",  descricao: "Aveia, linhaca e chia",               emoji: "", categoria: "integrais",  preco: 4.00, estoque_max: 50,  disponivel_hoje: false, ordem: 4 },
    { padaria_id: padaria.id, nome: "Baguete",       descricao: "Fermentacao natural, 24h",            emoji: "", categoria: "classicos",  preco: 8.00, estoque_max: 30,  ordem: 5 },
    { padaria_id: padaria.id, nome: "Pao de mel",    descricao: "Mel e canela, unidade",               emoji: "", categoria: "doces",      preco: 3.00, estoque_max: 60,  badge: "novo",     ordem: 6 },
  ]);

  const clientes = await knex("clientes").insert([
    { nome: "Maria Silva",   telefone: "93992014455", endereco_bairro: "Centro",    avatar_idx: 0 },
    { nome: "Joao Pereira",  telefone: "93988110032", endereco_bairro: "Aparecida", avatar_idx: 1 },
  ]).returning("*");

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dataEntrega = amanha.toISOString().split("T")[0];

  const produtos = await knex("produtos").where({ padaria_id: padaria.id }).orderBy("ordem");

  const [p1] = await knex("pedidos").insert({
    padaria_id: padaria.id, cliente_id: clientes[0].id, numero: 1,
    tipo_entrega: "delivery", endereco_entrega: "Rua das Flores, 142",
    bairro_entrega: "Centro", status: "pronto",
    subtotal: 9.00, taxa_delivery: 3.00, total: 12.00, data_entrega: dataEntrega,
  }).returning("*");

  await knex("itens_pedido").insert([
    { pedido_id: p1.id, produto_id: produtos[1].id, quantidade: 1, preco_unitario: 2.50, subtotal: 2.50 },
    { pedido_id: p1.id, produto_id: produtos[2].id, quantidade: 1, preco_unitario: 6.50, subtotal: 6.50 },
  ]);
  await knex("pagamentos").insert({ pedido_id: p1.id, metodo: "pix", status: "pago", valor: 12.00, pago_em: new Date() });

  const [p2] = await knex("pedidos").insert({
    padaria_id: padaria.id, cliente_id: clientes[1].id, numero: 2,
    tipo_entrega: "retirada", status: "aguardando",
    subtotal: 10.50, taxa_delivery: 0, total: 10.50, data_entrega: dataEntrega,
  }).returning("*");

  await knex("itens_pedido").insert([
    { pedido_id: p2.id, produto_id: produtos[0].id, quantidade: 2, preco_unitario: 0.75, subtotal: 1.50 },
    { pedido_id: p2.id, produto_id: produtos[4].id, quantidade: 1, preco_unitario: 8.00, subtotal: 8.00 },
  ]);
  await knex("pagamentos").insert({ pedido_id: p2.id, metodo: "pendente", status: "pendente", valor: 10.50 });

  console.log(" Seed concluido!");
  console.log("   Login do dono: telefone 93988001234 | senha: admin123");
};

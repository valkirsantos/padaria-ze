exports.up = async function(knex) {
  await knex.schema.createTable("pedidos", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("padaria_id").notNullable().references("id").inTable("padaria").onDelete("CASCADE");
    table.uuid("cliente_id").notNullable().references("id").inTable("clientes").onDelete("RESTRICT");
    table.integer("numero").notNullable();
    table.string("tipo_entrega", 20).notNullable();
    table.string("endereco_entrega", 200).nullable();
    table.string("bairro_entrega",    80).nullable();
    table.string("comp_entrega",      80).nullable();
    table.string("status", 20).defaultTo("aguardando");
    table.decimal("subtotal",      8, 2).notNullable();
    table.decimal("taxa_delivery", 8, 2).defaultTo(0);
    table.decimal("total",         8, 2).notNullable();
    table.date("data_entrega").notNullable();
    table.text("observacao").nullable();
    table.timestamps(true, true);
    table.index(["padaria_id","data_entrega","status"], "idx_pedidos_dia");
    table.unique(["padaria_id","data_entrega","numero"]);
  });

  await knex.schema.createTable("itens_pedido", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("pedido_id").notNullable().references("id").inTable("pedidos").onDelete("CASCADE");
    table.uuid("produto_id").notNullable().references("id").inTable("produtos").onDelete("RESTRICT");
    table.integer("quantidade").notNullable();
    table.decimal("preco_unitario", 8, 2).notNullable();
    table.decimal("subtotal",       8, 2).notNullable();
    table.index(["pedido_id"], "idx_itens_pedido");
  });

  await knex.schema.createTable("pagamentos", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("pedido_id").notNullable().unique().references("id").inTable("pedidos").onDelete("CASCADE");
    table.string("metodo", 30).defaultTo("pendente");
    table.string("status", 20).defaultTo("pendente");
    table.decimal("valor", 8, 2).notNullable();
    table.timestamp("pago_em").nullable();
    table.string("gateway_id",     100).nullable();
    table.string("gateway_status",  50).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("otps", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("telefone", 20).notNullable();
    table.string("codigo",    6).notNullable();
    table.boolean("usado").defaultTo(false);
    table.timestamp("expires_at").notNullable();
    table.timestamps(true, true);
    table.index(["telefone","codigo","usado","expires_at"], "idx_otps_validacao");
  });
};
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("otps");
  await knex.schema.dropTableIfExists("pagamentos");
  await knex.schema.dropTableIfExists("itens_pedido");
  await knex.schema.dropTableIfExists("pedidos");
};

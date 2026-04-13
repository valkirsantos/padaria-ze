exports.up = async function(knex) {
  await knex.schema.createTable("configuracoes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("padaria_id").notNullable().unique().references("id").inTable("padaria").onDelete("CASCADE");
    table.string("horario_abertura",   5).defaultTo("07:00");
    table.string("horario_fechamento", 5).defaultTo("12:00");
    table.string("horario_corte",      5).defaultTo("20:00");
    table.string("horario_aviso_corte",5).defaultTo("19:00");
    table.decimal("pedido_minimo", 8, 2).defaultTo(0);
    table.boolean("aceita_delivery").defaultTo(true);
    table.decimal("raio_delivery_km", 5, 1).defaultTo(5);
    table.jsonb("taxas_delivery").defaultTo("{}");
    table.boolean("aceita_pix").defaultTo(true);
    table.boolean("aceita_cartao").defaultTo(true);
    table.boolean("aceita_dinheiro").defaultTo(false);
    table.string("pix_chave", 150).nullable();
    table.string("pix_tipo",   20).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("produtos", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("padaria_id").notNullable().references("id").inTable("padaria").onDelete("CASCADE");
    table.string("nome", 100).notNullable();
    table.string("descricao", 300).nullable();
    table.string("emoji", 10).defaultTo("");
    table.string("foto_url", 500).nullable();
    table.string("categoria", 30).defaultTo("classicos");
    table.string("unidade",   20).defaultTo("unidade");
    table.decimal("preco", 8, 2).notNullable();
    table.integer("estoque_max").defaultTo(100);
    table.boolean("ativo").defaultTo(true);
    table.boolean("disponivel_hoje").defaultTo(true);
    table.boolean("permite_delivery").defaultTo(true);
    table.string("alergenos",    200).nullable();
    table.string("nota_producao",300).nullable();
    table.string("badge",  20).nullable();
    table.integer("ordem").defaultTo(0);
    table.timestamps(true, true);
    table.index(["padaria_id","categoria","ativo","disponivel_hoje"], "idx_produtos_catalogo");
  });
};
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("produtos");
  await knex.schema.dropTableIfExists("configuracoes");
};

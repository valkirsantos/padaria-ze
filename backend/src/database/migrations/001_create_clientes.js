exports.up = function(knex) {
  return knex.schema.createTable("clientes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("telefone", 20).notNullable().unique();
    table.string("nome", 100).notNullable();
    table.string("endereco_rua",    150).nullable();
    table.string("endereco_bairro",  80).nullable();
    table.string("endereco_comp",    80).nullable();
    table.jsonb("preferencias").defaultTo("[]");
    table.integer("avatar_idx").defaultTo(0);
    table.boolean("ativo").defaultTo(true);
    table.timestamps(true, true);
  });
};
exports.down = function(knex) {
  return knex.schema.dropTableIfExists("clientes");
};

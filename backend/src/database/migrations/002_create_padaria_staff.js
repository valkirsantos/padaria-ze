exports.up = async function(knex) {
  await knex.schema.createTable("padaria", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("nome", 100).notNullable();
    table.string("telefone", 20).nullable();
    table.string("endereco", 200).nullable();
    table.string("cidade", 80).nullable();
    table.string("estado", 2).nullable();
    table.string("foto_url", 500).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("staff", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("padaria_id").notNullable().references("id").inTable("padaria").onDelete("CASCADE");
    table.string("nome", 100).notNullable();
    table.string("telefone", 20).notNullable().unique();
    table.string("senha_hash", 255).notNullable();
    table.enum("papel", ["dono", "funcionario"]).defaultTo("funcionario");
    table.boolean("ativo").defaultTo(true);
    table.timestamps(true, true);
  });
};
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("staff");
  await knex.schema.dropTableIfExists("padaria");
};

require("dotenv").config();

module.exports = {
  development: {
    client: "pg",
    connection: {
      host:     process.env.DB_HOST     || "localhost",
      port:     Number(process.env.DB_PORT || 5432),
      user:     process.env.DB_USER     || "padaria",
      password: process.env.DB_PASSWORD || "padaria123",
      database: process.env.DB_NAME     || "padaria_dev",
    },
    pool: { min: 2, max: 10 },
    migrations: {
      directory: "./src/database/migrations",
      tableName:  "knex_migrations",
    },
    seeds: {
      directory: "./src/database/seeds",
    },
  },
  production: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 2, max: 10 },
    migrations: {
      directory: "./src/database/migrations",
      tableName:  "knex_migrations",
    },
  },
};

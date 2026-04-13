require("dotenv").config();
const knex = require("knex");
const config = require("../../knexfile");

const env = process.env.NODE_ENV || "development";
const db = knex(config[env]);

db.raw("SELECT 1")
  .then(() => console.log(" Banco de dados conectado"))
  .catch(err => {
    console.error(" Falha ao conectar no banco:", err.message);
    process.exit(1);
  });

module.exports = db;

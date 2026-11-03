const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

pool
  .query("SELECT NOW()")
  .then((res) =>
    console.log("✅ Database Connected Successfully:", res.rows[0]),
  )
  .catch((err) => console.error("❌ Database Connection Failed:", err.message));
// ============================

module.exports = pool;

const fs = require('fs');
const path = require('path');
const { createDatabaseConnection } = require('./data');

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function appliedMigrations(connection) {
  const [rows] = await connection.query('SELECT name FROM migrations ORDER BY id ASC');
  return new Set(rows.map((row) => row.name));
}

async function runMigrations() {
  const connection = await createDatabaseConnection();
  try {
    await ensureMigrationsTable(connection);
    const applied = await appliedMigrations(connection);
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.js')).sort()
      : [];

    const executed = [];

    for (const file of files) {
      if (applied.has(file)) continue;
      const migration = require(path.join(migrationsDir, file));
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${file} does not export up(connection)`);
      }
      await migration.up(connection);
      await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      executed.push(file);
    }

    return { executed, total: files.length };
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };

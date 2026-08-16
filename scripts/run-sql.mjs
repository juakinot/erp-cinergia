/**
 * Ejecuta un archivo .sql contra la base de datos usando DIRECT_URL.
 * Uso: node scripts/run-sql.mjs prisma/sql/01_rls_policies.sql
 *
 * pg permite múltiples sentencias en una sola llamada a query() cuando no
 * se usan parámetros — por eso no hace falta partir el archivo por ";".
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/run-sql.mjs <archivo.sql>');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
const client = new Client({ connectionString: process.env.DIRECT_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log(`✓ Aplicado: ${file}`);
} catch (err) {
  console.error(`✗ Error aplicando ${file}:`);
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}

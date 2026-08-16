/**
 * Verificación post-setup: confirma que las tablas, RLS y vistas quedaron
 * como se espera. No modifica nada — solo lee.
 */
import 'dotenv/config';
import { Client } from 'pg';

const client = new Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const { rows: tables } = await client.query(`
  select count(*)::int as n from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
`);
console.log(`Tablas en public: ${tables[0].n}`);

const { rows: noRls } = await client.query(`
  select relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
`);
console.log(
  noRls.length === 0
    ? '✓ Todas las tablas tienen RLS activado'
    : `⚠️ Sin RLS: ${noRls.map((r) => r.relname).join(', ')}`
);

const { rows: views } = await client.query(`
  select viewname from pg_views where schemaname = 'public' order by viewname
`);
console.log(`Vistas de reporte: ${views.map((v) => v.viewname).join(', ')}`);

const { rows: policies } = await client.query(`
  select count(*)::int as n from pg_policies where schemaname = 'public'
`);
console.log(`Políticas RLS creadas: ${policies[0].n}`);

const { rows: ext } = await client.query(`
  select extname from pg_extension where extname = 'citext'
`);
console.log(ext.length > 0 ? '✓ citext habilitado' : '✗ citext NO habilitado');

await client.end();

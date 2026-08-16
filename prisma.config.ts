import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 movió las cadenas de conexión fuera de schema.prisma.
 *
 * DIRECT_URL  → conexión directa al Postgres de Supabase (puerto 5432).
 *               La usan las migraciones, que necesitan sesión persistente.
 * DATABASE_URL → conexión vía pooler de Supabase (puerto 6543).
 *               La usa la aplicación en runtime.
 *
 * Ambas viven en .env, nunca en el repositorio.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente de Prisma compartido por toda la aplicación.
 *
 * Prisma 7 eliminó la conexión implícita vía `datasource.url` — ahora exige
 * un driver adapter explícito. Usamos DATABASE_URL (el pooler de Supabase,
 * puerto 6543), no DIRECT_URL: el pooler es el que soporta el volumen de
 * conexiones concurrentes que genera Next.js en runtime.
 *
 * El patrón globalThis evita que el hot-reload de desarrollo abra una
 * conexión nueva en cada guardado de archivo.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

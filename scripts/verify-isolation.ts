/**
 * Verificación de aislamiento por área con sesiones reales.
 *
 * Siembra los usuarios y datos de prueba, y en el mismo proceso inicia
 * sesión como cada uno usando la clave `anon` — la misma que usa el
 * navegador — y confirma qué puede y qué no puede leer. Si esto pasa,
 * RLS protege la API real, no solo la teoría del esquema.
 *
 * Las contraseñas generadas viven solo en memoria durante esta corrida.
 *
 * Uso: npm run verify:isolation
 */
import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createTestUsers,
  createTestInitiatives,
  db,
  MARKETING_TEST_CODE,
  PROJECTS_TEST_CODE,
  type CreatedTestUser,
} from '../prisma/seed-test-users';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Check {
  label: string;
  pass: boolean;
  detail: string;
}

const results: Check[] = [];

function record(label: string, pass: boolean, detail: string) {
  results.push({ label, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function sessionFor(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return client;
}

async function visibleInitiativeCodes(client: SupabaseClient) {
  const { data, error } = await client.from('initiatives').select('code');
  if (error) return { codes: [] as string[], error: error.message };
  return { codes: (data ?? []).map((r) => r.code as string), error: null };
}

/** true = pudo leer la vista. Esto NUNCA debería pasar desde el cliente (ver D8). */
async function canReadReportView(client: SupabaseClient) {
  const { error } = await client.from('v_report_initiatives').select('code').limit(1);
  return error === null;
}

async function main() {
  console.log('Paso 1/2 — Sembrando usuarios y datos de prueba...\n');
  const users = await createTestUsers();
  await createTestInitiatives(users);
  console.log(`✓ ${users.length} usuarios y 2 iniciativas de prueba listas\n`);

  const byEmail = (email: string): CreatedTestUser => {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error(`Usuario de prueba no encontrado: ${email}`);
    return u;
  };

  console.log('Paso 2/2 — Verificando aislamiento con sesiones reales (clave anon)\n');

  // ── Director de Marketing: debe ver CM, no debe ver PY ──
  {
    const u = byEmail('director.marketing@test.cinergia.pe');
    const client = await sessionFor(u.email, u.password);
    const { codes } = await visibleInitiativeCodes(client);
    record(
      'Director de Marketing ve su propia iniciativa (CM-2026-900)',
      codes.includes(MARKETING_TEST_CODE),
      `códigos visibles: ${codes.join(', ') || '(ninguno)'}`
    );
    record(
      'Director de Marketing NO ve la de Proyectos (PY-2026-900)',
      !codes.includes(PROJECTS_TEST_CODE),
      codes.includes(PROJECTS_TEST_CODE) ? 'FUGA DE DATOS ENTRE ÁREAS' : 'correctamente oculta'
    );
  }

  // ── Director de Proyectos: el espejo exacto del caso anterior ──
  {
    const u = byEmail('director.proyectos@test.cinergia.pe');
    const client = await sessionFor(u.email, u.password);
    const { codes } = await visibleInitiativeCodes(client);
    record(
      'Director de Proyectos ve su propia iniciativa (PY-2026-900)',
      codes.includes(PROJECTS_TEST_CODE),
      `códigos visibles: ${codes.join(', ') || '(ninguno)'}`
    );
    record(
      'Director de Proyectos NO ve la de Marketing (CM-2026-900)',
      !codes.includes(MARKETING_TEST_CODE),
      codes.includes(MARKETING_TEST_CODE) ? 'FUGA DE DATOS ENTRE ÁREAS' : 'correctamente oculta'
    );
  }

  // ── Presidente: debe ver ambas ──
  {
    const u = byEmail('presidente@test.cinergia.pe');
    const client = await sessionFor(u.email, u.password);
    const { codes } = await visibleInitiativeCodes(client);
    record(
      'Presidente ve las 2 iniciativas de prueba (las 3 áreas)',
      codes.includes(MARKETING_TEST_CODE) && codes.includes(PROJECTS_TEST_CODE),
      `códigos visibles: ${codes.join(', ') || '(ninguno)'}`
    );
  }

  // ── Coordinador y Miembro de Marketing: mismo patrón que su Director ──
  for (const [role, email] of [
    ['Coordinador', 'coordinador@test.cinergia.pe'],
    ['Miembro', 'miembro@test.cinergia.pe'],
  ] as const) {
    const u = byEmail(email);
    const client = await sessionFor(u.email, u.password);
    const { codes } = await visibleInitiativeCodes(client);
    record(
      `${role} de Marketing ve CM-2026-900, no ve PY-2026-900`,
      codes.includes(MARKETING_TEST_CODE) && !codes.includes(PROJECTS_TEST_CODE),
      `códigos visibles: ${codes.join(', ') || '(ninguno)'}`
    );
  }

  // ── Director de Reportes: NO debe ver NINGUNA fila de la tabla cruda ──
  {
    const u = byEmail('director.reportes@test.cinergia.pe');
    const client = await sessionFor(u.email, u.password);
    const { codes } = await visibleInitiativeCodes(client);
    record(
      'Director de Reportes NO ve ninguna iniciativa cruda (solo agregados vía vistas)',
      codes.length === 0,
      codes.length > 0 ? `FUGA: vio ${codes.join(', ')}` : 'tabla operativa correctamente bloqueada'
    );

    const canRead = await canReadReportView(client);
    record(
      'Director de Reportes NO puede leer v_report_initiatives desde el cliente',
      !canRead,
      canRead ? 'FUGA: la vista es legible con la clave anon' : 'bloqueada como se espera (D8)'
    );
  }

  // ── Verificación cruzada: ni siquiera Presidencia lee las vistas desde el cliente ──
  {
    const u = byEmail('presidente@test.cinergia.pe');
    const client = await sessionFor(u.email, u.password);
    const canRead = await canReadReportView(client);
    record(
      'Presidente tampoco puede leer las vistas desde el cliente (solo servidor)',
      !canRead,
      canRead ? 'FUGA' : 'bloqueada como se espera (D8)'
    );
  }

  console.log('\n─────────────────────────────────────────────────────────');
  const failed = results.filter((r) => !r.pass);
  if (failed.length === 0) {
    console.log(`✓ TODAS LAS VERIFICACIONES PASARON (${results.length}/${results.length})`);
  } else {
    console.log(`✗ ${failed.length} DE ${results.length} VERIFICACIONES FALLARON:`);
    for (const f of failed) console.log(`  - ${f.label}: ${f.detail}`);
    process.exitCode = 1;
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('✗ Error inesperado:', e);
  process.exit(1);
});

/**
 * Usuarios y datos de prueba para verificar el aislamiento por área.
 *
 * NO correr contra producción — los correos son claramente de prueba
 * (@test.cinergia.pe) y el script borra y recrea todo en cada corrida
 * para que la verificación parta siempre del mismo estado conocido.
 *
 * Exporta sus funciones para que scripts/verify-isolation.ts las encadene
 * en el mismo proceso — así las contraseñas generadas viven solo en memoria
 * y nunca tocan un archivo, una variable de entorno persistida ni la salida
 * de un proceso separado.
 *
 * Uso standalone: npm run seed:test-users
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createAdminClient } from '../src/lib/supabase/admin';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const db = new PrismaClient({ adapter });
const admin = createAdminClient();

export interface TestUserSpec {
  email: string;
  fullName: string;
  role: 'PRESIDENT' | 'AREA_DIRECTOR' | 'REPORTS_DIRECTOR' | 'COORDINATOR' | 'MEMBER';
  areaSlug: 'EVENTS' | 'MARKETING' | 'PROJECTS' | null;
}

export type CreatedTestUser = TestUserSpec & { id: string; password: string };

export const TEST_USERS: TestUserSpec[] = [
  { email: 'presidente@test.cinergia.pe', fullName: '[PRUEBA] Presidente', role: 'PRESIDENT', areaSlug: null },
  { email: 'director.marketing@test.cinergia.pe', fullName: '[PRUEBA] Director de Marketing', role: 'AREA_DIRECTOR', areaSlug: 'MARKETING' },
  { email: 'director.proyectos@test.cinergia.pe', fullName: '[PRUEBA] Director de Proyectos', role: 'AREA_DIRECTOR', areaSlug: 'PROJECTS' },
  { email: 'director.reportes@test.cinergia.pe', fullName: '[PRUEBA] Director de Reportes', role: 'REPORTS_DIRECTOR', areaSlug: null },
  { email: 'coordinador@test.cinergia.pe', fullName: '[PRUEBA] Coordinador de Marketing', role: 'COORDINATOR', areaSlug: 'MARKETING' },
  { email: 'miembro@test.cinergia.pe', fullName: '[PRUEBA] Miembro de Marketing', role: 'MEMBER', areaSlug: 'MARKETING' },
];

export const MARKETING_TEST_CODE = 'CM-2026-900';
export const PROJECTS_TEST_CODE = 'PY-2026-900';

function randomPassword() {
  // 24 caracteres, suficiente para la política de Supabase. Vive solo en
  // memoria durante esta corrida — nunca se escribe a disco.
  return crypto.randomBytes(18).toString('base64url');
}

async function deleteExistingByEmail(email: string) {
  // supabase-js no tiene "getUserByEmail" en la Admin API; se pagina la
  // lista, que en un proyecto de prueba nunca va a ser grande.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) {
      await admin.auth.admin.deleteUser(match.id);
      return;
    }
    if (data.users.length < 200) return;
    page += 1;
  }
}

/**
 * Se corre antes de tocar los usuarios: las iniciativas de prueba los
 * referencian con onDelete: Restrict, así que borrar un usuario antes
 * rompe con una violación de llave foránea.
 */
export async function deleteTestInitiatives() {
  await db.initiative.deleteMany({
    where: { code: { in: [MARKETING_TEST_CODE, PROJECTS_TEST_CODE] } },
  });
}

export async function createTestUsers(): Promise<CreatedTestUser[]> {
  await deleteTestInitiatives();

  const areas = await db.area.findMany();
  const areaBySlug = new Map(areas.map((a) => [a.slug, a]));

  const created: CreatedTestUser[] = [];

  for (const spec of TEST_USERS) {
    // Se borra el usuario de Auth Y su fila en public.users. La recreación
    // usa un UUID nuevo cada vez (Supabase no permite elegirlo), así que un
    // upsert por id nunca encontraría la fila vieja — hay que limpiarla por
    // email explícitamente o el insert siguiente choca con el unique.
    await deleteExistingByEmail(spec.email);
    await db.user.deleteMany({ where: { email: spec.email } });

    const password = randomPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true, // sin esto, Supabase exige verificar el correo antes de poder loguear
    });
    if (error || !data.user) {
      throw new Error(`No se pudo crear ${spec.email}: ${error?.message}`);
    }

    const area = spec.areaSlug ? areaBySlug.get(spec.areaSlug) : null;

    await db.user.create({
      data: {
        id: data.user.id,
        email: spec.email,
        fullName: spec.fullName,
        role: spec.role,
        areaId: area?.id ?? null,
      },
    });

    created.push({ ...spec, id: data.user.id, password });
  }

  return created;
}

export async function createTestInitiatives(users: CreatedTestUser[]) {
  const marketing = await db.area.findUniqueOrThrow({ where: { slug: 'MARKETING' } });
  const projects = await db.area.findUniqueOrThrow({ where: { slug: 'PROJECTS' } });

  const coordinador = users.find((u) => u.email === 'coordinador@test.cinergia.pe')!;
  const directorMarketing = users.find((u) => u.email === 'director.marketing@test.cinergia.pe')!;
  const directorProyectos = users.find((u) => u.email === 'director.proyectos@test.cinergia.pe')!;

  await db.initiative.create({
    data: {
      code: MARKETING_TEST_CODE,
      year: 2026,
      sequence: 900,
      type: 'CAMPAIGN',
      areaId: marketing.id,
      title: '[PRUEBA] Campaña de aislamiento — Marketing',
      description: 'Iniciativa de prueba, solo para verificar RLS. No es una campaña real.',
      objective: 'Verificar que solo Marketing y Presidencia pueden leer esta fila.',
      modality: 'VIRTUAL',
      coordinatorUserId: coordinador.id,
      createdByUserId: directorMarketing.id,
    },
  });

  await db.initiative.create({
    data: {
      code: PROJECTS_TEST_CODE,
      year: 2026,
      sequence: 900,
      type: 'PROJECT',
      areaId: projects.id,
      title: '[PRUEBA] Proyecto de aislamiento — Proyectos',
      description: 'Iniciativa de prueba, solo para verificar RLS. No es un proyecto real.',
      objective: 'Verificar que solo Proyectos y Presidencia pueden leer esta fila.',
      modality: 'IN_PERSON',
      coordinatorUserId: directorProyectos.id,
      createdByUserId: directorProyectos.id,
    },
  });
}

async function standaloneMain() {
  console.log('Sembrando usuarios de prueba...\n');
  const users = await createTestUsers();
  console.log(`✓ ${users.length} usuarios de prueba creados/reseteados en Supabase Auth\n`);

  await createTestInitiatives(users);
  console.log('✓ 2 iniciativas de prueba creadas: CM-2026-900 (Marketing), PY-2026-900 (Proyectos)');

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('Credenciales de esta corrida — solo aparecen aquí, no se guardan:');
  console.log('─────────────────────────────────────────────────────────');
  for (const u of users) {
    console.log(`${u.role.padEnd(17)} ${u.email.padEnd(34)} ${u.password}`);
  }
  console.log('─────────────────────────────────────────────────────────');
  await db.$disconnect();
}

// Detecta si este archivo se ejecutó directamente (no importado desde otro script).
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  standaloneMain().catch((e) => {
    console.error('✗ Error:', e);
    process.exit(1);
  });
}

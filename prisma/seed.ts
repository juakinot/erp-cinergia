/**
 * Siembra inicial: las 3 áreas, las 3 plantillas de acta y el umbral de
 * escalación a Presidencia. Idempotente — se puede correr varias veces.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import {
  ACTA_TEMPLATES,
  EVENT_ACTA_TEMPLATE,
  PROJECT_ACTA_TEMPLATE,
  CAMPAIGN_ACTA_TEMPLATE,
} from '../src/lib/actas/templates';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function seedAreas() {
  const areas = [
    {
      slug: 'EVENTS' as const,
      name: 'Eventos',
      formalName: 'Dirección de Comunidad y Eventos',
      defaultInitiativeType: 'EVENT' as const,
      codePrefix: 'EV',
    },
    {
      slug: 'MARKETING' as const,
      name: 'Marketing',
      formalName: 'Área de Marketing',
      defaultInitiativeType: 'CAMPAIGN' as const,
      codePrefix: 'CM',
    },
    {
      slug: 'PROJECTS' as const,
      name: 'Proyectos',
      formalName: 'Área de Proyectos e Investigación',
      defaultInitiativeType: 'PROJECT' as const,
      codePrefix: 'PY',
    },
  ];

  for (const area of areas) {
    await db.area.upsert({
      where: { slug: area.slug },
      create: area,
      update: {
        name: area.name,
        formalName: area.formalName,
        defaultInitiativeType: area.defaultInitiativeType,
        codePrefix: area.codePrefix,
      },
    });
  }
  console.log(`✓ ${areas.length} áreas sembradas`);
}

async function seedActaTemplates() {
  for (const tpl of ACTA_TEMPLATES) {
    await db.actaTemplate.upsert({
      where: {
        initiativeType_version: {
          initiativeType: tpl.initiativeType,
          version: tpl.version,
        },
      },
      create: {
        initiativeType: tpl.initiativeType,
        name: tpl.name,
        version: tpl.version,
        // El JSON completo de la definición: secciones, campos, orígenes.
        // El formulario y el generador de PDF leen esto directamente.
        structureSchema: JSON.parse(JSON.stringify(tpl)),
        promptTemplate: tpl.promptTemplate,
        isActive: true,
      },
      update: {
        name: tpl.name,
        structureSchema: JSON.parse(JSON.stringify(tpl)),
        promptTemplate: tpl.promptTemplate,
      },
    });
  }
  console.log(
    `✓ ${ACTA_TEMPLATES.length} plantillas de acta sembradas (${EVENT_ACTA_TEMPLATE.name}, ${PROJECT_ACTA_TEMPLATE.name}, ${CAMPAIGN_ACTA_TEMPLATE.name})`
  );
}

async function seedAppSettings() {
  await db.appSetting.upsert({
    where: { key: 'escalation.budget_threshold_pen' },
    create: {
      key: 'escalation.budget_threshold_pen',
      value: 2000,
      description:
        'Monto en soles a partir del cual la aprobación de una iniciativa escala de Director de Área a Presidencia (Arquitectura v2.1 §01).',
    },
    update: {},
  });

  await db.appSetting.upsert({
    where: { key: 'idea_campaign.vote_threshold' },
    create: {
      key: 'idea_campaign.vote_threshold',
      value: 5,
      description: 'Votos necesarios para que una idea sea promovible a iniciativa.',
    },
    update: {},
  });

  await db.appSetting.upsert({
    where: { key: 'idea_campaign.min_days_between' },
    create: {
      key: 'idea_campaign.min_days_between',
      value: 7,
      description: 'Días mínimos entre el cierre de una campaña de ideación y la apertura de la siguiente.',
    },
    update: {},
  });

  console.log('✓ 3 parámetros de configuración sembrados');
}

async function main() {
  console.log('Sembrando ERP CINERGIA...\n');
  await seedAreas();
  await seedActaTemplates();
  await seedAppSettings();
  console.log('\nListo.');
}

main()
  .catch((e) => {
    console.error('✗ Error en la siembra:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

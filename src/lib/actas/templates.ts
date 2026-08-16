import type { ActaTemplateDefinition } from './types';

/**
 * Plantillas de acta, transcritas de los formatos oficiales de CINERGIA.
 *
 * Las etiquetas y textos de ayuda se conservan literales para que el PDF
 * generado sea reconocible como el mismo documento que el equipo ya usa.
 */

// ═══════════════════════════════════════════════════════════
// ACTA DE EVENTO — 16 secciones
// ═══════════════════════════════════════════════════════════

export const EVENT_ACTA_TEMPLATE: ActaTemplateDefinition = {
  initiativeType: 'EVENT',
  name: 'Acta de Evento',
  version: 1,
  documentTitle: 'ACTA DE EVENTO - CINERGIA',
  requiresPresidencySignature: false,
  sections: [
    {
      id: 'record',
      order: 1,
      title: 'Ficha de Evento',
      fields: [
        {
          id: 'actaNumber',
          label: 'N.º de Acta',
          type: 'shortText',
          source: { kind: 'initiative', path: 'code' },
          required: true,
          help: 'Código único que identifica el evento para fines de control, seguimiento y archivo.',
        },
      ],
    },
    {
      id: 'title',
      order: 2,
      title: 'Título del Evento',
      fields: [
        {
          id: 'eventTitle',
          label: 'Título del Evento',
          type: 'shortText',
          source: { kind: 'initiative', path: 'title' },
          required: true,
          help: 'Nombre oficial del evento. Debe ser claro, representativo y coherente con el objetivo del evento.',
        },
      ],
    },
    {
      id: 'organization',
      order: 3,
      title: 'Organización Responsable',
      help: 'Área organizadora y personas responsables directas de la planificación, ejecución y cierre del evento.',
      fields: [
        {
          id: 'area',
          label: 'Área',
          type: 'shortText',
          source: { kind: 'initiative', path: 'area.formalName' },
          required: true,
        },
        {
          id: 'responsibles',
          label: 'Responsables',
          type: 'personList',
          source: { kind: 'team' },
          required: true,
        },
      ],
    },
    {
      id: 'deliveryDate',
      order: 4,
      title: 'Fecha de Entrega del Acta',
      fields: [
        {
          id: 'deliveryDate',
          label: 'Fecha de Entrega del Acta',
          type: 'date',
          source: { kind: 'manual' },
          required: true,
          help: 'Fecha en la que el acta es presentada oficialmente para validación y registro.',
        },
      ],
    },
    {
      id: 'executiveSummary',
      order: 5,
      title: 'Resumen Ejecutivo del Evento',
      fields: [
        {
          id: 'executiveSummary',
          label: 'Resumen Ejecutivo',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
          maxWords: 150,
          help: 'Síntesis general del evento (máx. 1 párrafo). Debe incluir propósito, público objetivo y resultado esperado.',
        },
      ],
    },
    {
      id: 'background',
      order: 6,
      title: 'Antecedentes y Justificación',
      fields: [
        {
          id: 'background',
          label: 'Antecedentes y Justificación',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
          help: 'Contexto que origina el evento y justificación de su realización. Explica por qué es relevante y qué necesidad atiende.',
        },
      ],
    },
    {
      id: 'generalInfo',
      order: 7,
      title: 'Información General del Evento',
      help: 'Datos operativos básicos del evento que permiten su correcta organización y difusión.',
      fields: [
        {
          id: 'dateTime',
          label: 'Fecha y Hora',
          type: 'dateTime',
          source: { kind: 'initiative', path: 'plannedDate' },
          required: true,
        },
        {
          id: 'modalityLocation',
          label: 'Modalidad / Ubicación',
          type: 'shortText',
          source: { kind: 'initiative', path: 'venue' },
          required: true,
        },
        {
          id: 'capacity',
          label: 'Capacidad',
          type: 'number',
          source: { kind: 'manual' },
          required: true,
        },
      ],
    },
    {
      id: 'objectives',
      order: 8,
      title: 'Objetivos del Evento',
      fields: [
        {
          id: 'generalObjective',
          label: 'Objetivo General',
          type: 'longText',
          source: { kind: 'initiative', path: 'objective' },
          required: true,
          help: 'Propósito principal del evento, alineado a los objetivos de la comunidad o institución.',
        },
        {
          id: 'specificObjectives',
          label: 'Objetivos Específicos',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
          help: 'Metas concretas y medibles que contribuyen al cumplimiento del objetivo general.',
        },
      ],
    },
    {
      id: 'schedule',
      order: 9,
      title: 'Cronograma General',
      fields: [
        {
          id: 'schedule',
          label: 'Cronograma General',
          type: 'pairList',
          source: { kind: 'milestones' },
          required: true,
          columns: ['Actividad', 'Fecha'],
          help: 'Secuencia temporal de las actividades principales del evento, indicando hitos clave antes, durante y después.',
        },
      ],
    },
    {
      id: 'speakers',
      order: 10,
      title: 'Ponentes / Participantes Clave',
      fields: [
        {
          id: 'speakers',
          label: 'Ponentes / Participantes Clave',
          type: 'pairList',
          source: { kind: 'manual' },
          required: false,
          columns: ['Nombre', 'Rol en el evento'],
          help: 'Relación de expositores, panelistas o invitados relevantes, incluyendo su rol dentro del evento.',
        },
      ],
    },
    {
      id: 'resources',
      order: 11,
      title: 'Recursos y Logística',
      fields: [
        {
          id: 'materials',
          label: 'Materiales',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
          help: 'Insumos físicos necesarios para el desarrollo del evento.',
        },
        {
          id: 'technology',
          label: 'Tecnología',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
          help: 'Herramientas tecnológicas requeridas (plataformas, equipos audiovisuales, software, etc.).',
        },
        {
          id: 'spaces',
          label: 'Espacios',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
          help: 'Ambientes físicos o virtuales donde se desarrollará el evento.',
        },
      ],
    },
    {
      id: 'outreach',
      order: 12,
      title: 'Plan de Difusión',
      fields: [
        {
          id: 'preEvent',
          label: 'Pre-Evento',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
          help: 'Acciones de comunicación previas para convocatoria y promoción.',
        },
        {
          id: 'duringEvent',
          label: 'Durante el Evento',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
          help: 'Estrategias de visibilidad y cobertura en tiempo real.',
        },
        {
          id: 'postEvent',
          label: 'Post-Evento',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
          help: 'Acciones posteriores para difusión de resultados, materiales y cierre comunicacional.',
        },
      ],
    },
    {
      id: 'kpis',
      order: 13,
      title: 'Métricas de Éxito (KPIs)',
      help: 'Indicadores que permiten evaluar el impacto y efectividad del evento.',
      fields: [
        {
          id: 'successMetrics',
          label: 'Métricas de Éxito',
          type: 'metricList',
          source: { kind: 'manual' },
          required: true,
          columns: ['Indicador', 'Meta'],
          // Umbrales institucionales del formato oficial. Editables por evento.
          defaultValue: [
            { metric: 'Asistencia', target: '≥ 25 participantes' },
            { metric: 'Participación en dinámicas', target: '≥ 55 %' },
            { metric: 'Nivel de satisfacción', target: '≥ 75 % (encuesta ≤ 5 ítems)' },
          ],
        },
        {
          id: 'measurementTools',
          label: 'Herramientas de Medición',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
          help: 'Instrumentos utilizados para la recolección de datos y evidencias.',
          defaultValue: ['Lista de asistencia digital', 'Encuesta QR', 'Registro fotográfico'],
        },
      ],
    },
    {
      id: 'risks',
      order: 14,
      title: 'Riesgos y Plan de Contingencia',
      fields: [
        {
          id: 'risks',
          label: 'Riesgos y Plan de Contingencia',
          type: 'riskTable',
          // Se arma con los riesgos ya registrados en la iniciativa: los que
          // nacieron de un input del Radar convertido aparecen aquí sin que
          // nadie los vuelva a escribir.
          source: { kind: 'risks' },
          required: true,
          help: 'Identificación de posibles riesgos operativos y acciones preventivas para minimizar su impacto.',
        },
      ],
    },
    {
      id: 'finalNotes',
      order: 15,
      title: 'Observaciones Finales',
      fields: [
        {
          id: 'finalNotes',
          label: 'Observaciones Finales',
          type: 'longText',
          source: { kind: 'manual' },
          required: false,
          help: 'Comentarios adicionales, aprendizajes clave o recomendaciones para futuros eventos.',
        },
      ],
    },
    {
      id: 'validation',
      order: 16,
      title: 'Validación y Cierre',
      help: 'Firmas o responsables que validan oficialmente el acta del evento.',
      fields: [
        {
          id: 'preparedBy',
          label: 'Elaborado por',
          type: 'shortText',
          source: { kind: 'initiative', path: 'coordinator.fullName' },
          required: true,
        },
        {
          id: 'reviewedBy',
          label: 'Revisado por',
          type: 'shortText',
          source: { kind: 'manual' },
          required: false,
        },
        {
          id: 'approvedBy',
          label: 'Aprobado por',
          type: 'shortText',
          // Lo completa el flujo de aprobación, no el formulario.
          source: { kind: 'manual' },
          required: false,
        },
      ],
    },
  ],
  promptTemplate: `Eres el asistente de redacción de actas de CINERGIA, asociación estudiantil de
ingeniería de la Universidad Científica del Sur.

Redacta el acta formal del evento a partir de los datos estructurados que se
entregan a continuación. Reglas:

- Español formal peruano, en tercera persona. Sin adjetivos promocionales.
- Respeta la numeración y los títulos de sección exactamente como vienen.
- No inventes datos. Si un campo viene vacío, escribe "Por definir".
- El resumen ejecutivo no debe exceder un párrafo.
- Las listas se mantienen como listas, no las conviertas en prosa.
- Devuelve markdown, sin bloque de código envolvente.

Datos del evento:
{{INPUT_DATA}}`,
};

// ═══════════════════════════════════════════════════════════
// ACTA DE CONSTITUCIÓN DEL PROYECTO
// ═══════════════════════════════════════════════════════════

export const PROJECT_ACTA_TEMPLATE: ActaTemplateDefinition = {
  initiativeType: 'PROJECT',
  name: 'Acta de Constitución del Proyecto',
  version: 1,
  documentTitle: 'ACTA DE CONSTITUCIÓN DEL PROYECTO',
  // El formato oficial lleva firma de Presidencia impresa, sin importar el monto.
  requiresPresidencySignature: true,
  sections: [
    {
      id: 'identification',
      order: 1,
      title: 'Identificación del Proyecto',
      fields: [
        {
          id: 'projectTitle',
          label: 'Título Proyecto',
          type: 'shortText',
          source: { kind: 'initiative', path: 'title' },
          required: true,
        },
        {
          id: 'preparationDate',
          label: 'Fecha de elaboración',
          type: 'date',
          source: { kind: 'manual' },
          required: true,
        },
        {
          id: 'client',
          label: 'Cliente del Proyecto',
          type: 'shortText',
          source: { kind: 'manual' },
          required: true,
        },
        {
          id: 'executor',
          label: 'Ejecutor',
          type: 'shortText',
          source: {
            kind: 'boilerplate',
            text: 'CINERGIA – Área de Proyectos e Investigación (bajo supervisión de la Facultad de Ingeniería).',
          },
          required: true,
        },
        {
          id: 'consultedAreas',
          label: 'Áreas clave consultadas',
          type: 'textList',
          source: { kind: 'manual' },
          required: false,
        },
        {
          id: 'endUsers',
          label: 'Usuarios finales',
          type: 'shortText',
          source: { kind: 'manual' },
          required: true,
        },
      ],
    },
    {
      id: 'justification',
      order: 2,
      title: 'Justificación del proyecto',
      fields: [
        {
          id: 'justification',
          label: 'Justificación del proyecto',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
        },
      ],
    },
    {
      id: 'description',
      order: 3,
      title: 'Descripción del proyecto',
      fields: [
        {
          id: 'description',
          label: 'Descripción del proyecto',
          type: 'longText',
          source: { kind: 'initiative', path: 'description' },
          required: true,
        },
      ],
    },
    {
      id: 'deliverables',
      order: 4,
      title: 'Entregables de Alto Nivel',
      fields: [
        {
          id: 'deliverables',
          label: 'Entregables de Alto Nivel',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
        },
      ],
    },
    {
      id: 'requirements',
      order: 5,
      title: 'Requerimientos de Alto Nivel',
      fields: [
        {
          id: 'requirements',
          label: 'Requerimientos de Alto Nivel',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
        },
      ],
    },
    {
      id: 'risks',
      order: 6,
      title: 'Riesgos del proyecto',
      fields: [
        {
          id: 'risks',
          label: 'Riesgos del proyecto',
          type: 'riskTable',
          source: { kind: 'risks' },
          required: true,
        },
      ],
    },
    {
      id: 'boundaries',
      order: 7,
      title: 'Límites del proyecto',
      help: 'Qué queda explícitamente fuera del alcance.',
      fields: [
        {
          id: 'exclusions',
          label: 'El proyecto no incluirá',
          type: 'textList',
          source: { kind: 'manual' },
          required: true,
        },
      ],
    },
    {
      id: 'objectives',
      order: 8,
      title: 'Objetivos del Proyecto',
      fields: [
        {
          id: 'generalObjective',
          label: 'Objetivo General del Proyecto',
          type: 'longText',
          source: { kind: 'initiative', path: 'objective' },
          required: true,
        },
        {
          id: 'specificObjectives',
          label: 'Objetivos Específicos del Proyecto',
          type: 'objectiveList',
          source: { kind: 'manual' },
          required: true,
          columns: ['Objetivo Específico', 'Criterios de Éxito'],
        },
      ],
    },
    {
      id: 'materials',
      order: 9,
      title: 'Materiales',
      fields: [
        {
          id: 'materials',
          label: 'Materiales',
          type: 'pairList',
          source: { kind: 'manual' },
          required: true,
          columns: ['Herramienta', 'Descripción de uso'],
        },
        {
          id: 'materialsNote',
          label: 'Nota sobre materiales',
          type: 'longText',
          source: {
            kind: 'boilerplate',
            text: 'Los materiales están sujetos a cambios debido a la escalabilidad, costos, volumen de usuarios y posibles optimizaciones en la arquitectura del sistema durante el desarrollo.',
          },
          required: false,
        },
      ],
    },
    {
      id: 'time',
      order: 10,
      title: 'Tiempo',
      fields: [
        {
          id: 'deliverableAndDate',
          label: 'Entregable principal y fecha',
          type: 'pairList',
          source: { kind: 'manual' },
          required: true,
          columns: ['Entregable', 'Fecha'],
        },
        {
          id: 'milestones',
          label: 'Resumen de Hitos',
          type: 'pairList',
          source: { kind: 'milestones' },
          required: true,
          columns: ['Fase', 'Fecha de cumplimiento'],
        },
      ],
    },
    {
      id: 'team',
      order: 11,
      title: 'Encargados del proyecto',
      fields: [
        {
          id: 'teamMembers',
          label: 'Encargados del proyecto',
          type: 'personList',
          source: { kind: 'team' },
          required: true,
          help: 'El coordinador de la iniciativa figura como Líder.',
        },
      ],
    },
    {
      id: 'authority',
      order: 12,
      title: 'Nivel de Autoridad del director del Proyecto',
      fields: [
        {
          id: 'staffDecisions',
          label: 'Decisiones sobre el personal',
          type: 'longText',
          source: {
            kind: 'boilerplate',
            text: 'El director del Proyecto tiene la autoridad para tomar decisiones sobre el personal, siempre en consulta con los responsables de cada área.',
          },
          required: true,
        },
        {
          id: 'technicalDecisions',
          label: 'Decisiones técnicas',
          type: 'longText',
          source: {
            kind: 'boilerplate',
            text: 'El director del Proyecto tomará las decisiones técnicas después de consultar con otros miembros clave del equipo.',
          },
          required: true,
        },
      ],
    },
    {
      id: 'approvals',
      order: 13,
      title: 'Aprobaciones',
      help: 'Encargados del proyecto, Dirección de Área y Presidencia. Las firmas de Dirección y Presidencia las completa el flujo de aprobación del sistema.',
      fields: [
        {
          id: 'projectOwners',
          label: 'Encargados del Proyecto',
          type: 'personList',
          source: { kind: 'team' },
          required: true,
        },
      ],
    },
  ],
  promptTemplate: `Eres el asistente de redacción de actas de CINERGIA, asociación estudiantil de
ingeniería de la Universidad Científica del Sur.

Redacta el Acta de Constitución del Proyecto a partir de los datos estructurados
que se entregan a continuación. Es un documento formal que puede ser revisado por
la Facultad de Ingeniería. Reglas:

- Español formal peruano, en tercera persona. Registro técnico, sin adornos.
- Respeta la numeración y los títulos de sección exactamente como vienen.
- No inventes datos. Si un campo viene vacío, escribe "Por definir".
- Los objetivos específicos van emparejados con sus criterios de éxito.
- Los límites del proyecto se redactan como exclusiones explícitas.
- Las listas se mantienen como listas, no las conviertas en prosa.
- Devuelve markdown, sin bloque de código envolvente.

Datos del proyecto:
{{INPUT_DATA}}`,
};

// ═══════════════════════════════════════════════════════════
// ACTA DE CAMPAÑA — registro ligero
// ═══════════════════════════════════════════════════════════

/**
 * Marketing no pasa por revisión externa: su acta es solo registro interno.
 * Por eso son cuatro campos y no dieciséis.
 */
export const CAMPAIGN_ACTA_TEMPLATE: ActaTemplateDefinition = {
  initiativeType: 'CAMPAIGN',
  name: 'Registro de Campaña',
  version: 1,
  documentTitle: 'REGISTRO DE CAMPAÑA - CINERGIA',
  requiresPresidencySignature: false,
  sections: [
    {
      id: 'summary',
      order: 1,
      title: 'Resumen de la Campaña',
      fields: [
        {
          id: 'campaignTitle',
          label: 'Título de la Campaña',
          type: 'shortText',
          source: { kind: 'initiative', path: 'title' },
          required: true,
        },
        {
          id: 'objective',
          label: 'Objetivo',
          type: 'longText',
          source: { kind: 'initiative', path: 'objective' },
          required: true,
        },
        {
          id: 'summary',
          label: 'Resumen y resultado',
          type: 'longText',
          source: { kind: 'manual' },
          required: true,
          maxWords: 200,
        },
      ],
    },
    {
      id: 'metrics',
      order: 2,
      title: 'Métricas de Alcance',
      fields: [
        {
          id: 'reachMetrics',
          label: 'Métricas de Alcance',
          type: 'metricList',
          source: { kind: 'manual' },
          required: true,
          columns: ['Indicador', 'Resultado'],
        },
      ],
    },
  ],
  promptTemplate: `Redacta un registro breve de campaña de marketing para CINERGIA a partir de los
datos entregados. Español formal, máximo dos párrafos más la tabla de métricas.
No inventes cifras. Devuelve markdown sin bloque de código envolvente.

Datos de la campaña:
{{INPUT_DATA}}`,
};

export const ACTA_TEMPLATES = [
  EVENT_ACTA_TEMPLATE,
  PROJECT_ACTA_TEMPLATE,
  CAMPAIGN_ACTA_TEMPLATE,
] as const;

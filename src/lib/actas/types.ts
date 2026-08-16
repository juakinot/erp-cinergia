/**
 * Tipos que describen la estructura de una plantilla de acta.
 *
 * Una misma definición sirve para tres cosas:
 *   1. Renderizar el formulario que llena el Coordinador.
 *   2. Construir el prompt que envía los datos al modelo de IA.
 *   3. Generar el PDF con el formato oficial de CINERGIA.
 *
 * Las etiquetas están en español porque se muestran tal cual al usuario.
 */

/**
 * De dónde sale el valor de un campo.
 *
 * Buena parte del acta ya existe en el sistema antes de que alguien la abra:
 * el código de la iniciativa, el equipo, los hitos del calendario y los riesgos
 * registrados. Marcar el origen evita pedirle a una persona que transcriba algo
 * que el sistema ya sabe.
 */
export type FieldSource =
  /** Lo escribe una persona. */
  | { kind: 'manual' }
  /** Se lee de la iniciativa; `path` es la ruta al campo (ej. "code", "area.formalName"). */
  | { kind: 'initiative'; path: string }
  /** Se arma con el equipo asignado (coordinador + responsables de tareas). */
  | { kind: 'team' }
  /** Se arma con los registros de `initiative_risks`. */
  | { kind: 'risks' }
  /** Se arma con los `calendar_items` de tipo MILESTONE. */
  | { kind: 'milestones' }
  /** Texto institucional fijo, precargado y editable. */
  | { kind: 'boilerplate'; text: string };

export type FieldType =
  | 'shortText'
  | 'longText'
  /** Lista de líneas sueltas: entregables, requerimientos, límites. */
  | 'textList'
  /** Lista de pares etiqueta → valor: hitos (fase → fecha), materiales (nombre → uso). */
  | 'pairList'
  /** Objetivo específico con sus criterios de éxito. */
  | 'objectiveList'
  /** Tabla de riesgos: descripción, probabilidad, impacto, mitigación. */
  | 'riskTable'
  /** Personas del equipo, una marcada como líder. */
  | 'personList'
  /** Métricas con su valor objetivo. */
  | 'metricList'
  | 'date'
  | 'dateTime'
  | 'number'
  | 'select';

export interface ActaField {
  /** Clave dentro de `acta.input_data`. */
  id: string;
  /** Etiqueta visible, tomada literal del formato oficial. */
  label: string;
  type: FieldType;
  source: FieldSource;
  required: boolean;
  /** Texto de ayuda del formato oficial, mostrado bajo el campo. */
  help?: string;
  /** Límite orientativo para campos de texto largo. */
  maxWords?: number;
  /** Valores precargados, editables por el usuario. */
  defaultValue?: unknown;
  /** Opciones para `select`. */
  options?: readonly string[];
  /** Etiquetas de columna para `pairList` y `objectiveList`. */
  columns?: readonly [string, string];
}

export interface ActaSection {
  id: string;
  /** Número de sección tal como aparece en el formato oficial. */
  order: number;
  title: string;
  help?: string;
  fields: readonly ActaField[];
}

export interface ActaTemplateDefinition {
  /** Coincide con el enum InitiativeType de Prisma. */
  initiativeType: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
  name: string;
  version: number;
  /** Encabezado que va en cada página del PDF. */
  documentTitle: string;
  /**
   * true cuando el formato oficial lleva firma de Presidencia impresa,
   * sin importar el monto. Es una excepción a la regla de escalación.
   */
  requiresPresidencySignature: boolean;
  sections: readonly ActaSection[];
  /** Instrucción base para la generación asistida por IA. */
  promptTemplate: string;
}

/** Campos que el sistema completa sin intervención humana. */
export function autoFilledFields(t: ActaTemplateDefinition): ActaField[] {
  return t.sections.flatMap((s) => s.fields).filter((f) => f.source.kind !== 'manual');
}

/** Campos que alguien debe escribir. */
export function manualFields(t: ActaTemplateDefinition): ActaField[] {
  return t.sections.flatMap((s) => s.fields).filter((f) => f.source.kind === 'manual');
}

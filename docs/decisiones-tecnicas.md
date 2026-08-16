# Decisiones técnicas — ERP CINERGIA

Registro de decisiones que afectan el código y que no son obvias al leerlo.
Complementa la Arquitectura v2.1 y la Especificación funcional v1.3.

---

## D1 · Inglés en el código, español en la interfaz

**Decisión.** Modelos, tablas, campos, enums y variables en inglés. Todo texto
que ve un usuario, en español.

**Por qué.** La especificación traía nomenclatura mezclada (`iniciativas`,
`presupuesto_proyectado` junto a `tasks`, `attachments`), y esa mezcla envejece
mal: obliga a recordar en qué idioma quedó cada tabla. Supabase Auth ya expone
`auth.users` en inglés, y cualquier persona que se sume al desarrollo va a leer
documentación en inglés.

**Excepción.** Términos sin equivalente limpio se mantienen: `sctr_status`
(SCTR es una figura del seguro peruano, no se traduce).

---

## D2 · `initiatives` desde el día uno, no `events`

**Decisión.** La tabla central se llama `initiatives` con un campo `type`
(`EVENT` | `CAMPAIGN` | `PROJECT`), aunque la Fase 1 solo use `EVENT`.

**Por qué.** El roadmap original planteaba construir `events` primero y
renombrar a `initiatives` en Fase 2. Esa migración toca la llave foránea de
nueve tablas, con datos reales ya cargados. Modelarlo bien desde ahora cuesta
cero adicional.

**Trade-off aceptado.** El esquema de Fase 1 contiene tablas que no se usarán
durante meses (ideación, encuestas, propuestas de mejora). Es preferible a
migrar en producción.

---

## D3 · Código de iniciativa derivado de `(type, year, sequence)`

**Decisión.** `code` (ej. `EV-2026-015`) es un campo único y denormalizado. La
unicidad real la garantiza el índice compuesto `(type, year, sequence)`.

**Por qué.** Generar el código concatenando strings y confiando solo en el
`unique` de `code` produce colisiones bajo concurrencia. Con el índice
compuesto, dos inserciones simultáneas del mismo tipo y año chocan a nivel de
base de datos y una falla limpiamente, en vez de generar dos códigos iguales.

**Implicación.** La generación del `sequence` debe ir dentro de una transacción
con `SELECT ... FOR UPDATE` o reintento ante violación de unicidad.

---

## D4 · Reportes no lee tablas operativas, ni con RLS a favor

**Decisión.** El rol `REPORTS_DIRECTOR` está deliberadamente ausente de las
políticas RLS de `initiatives`, `tasks`, `initiative_inputs` y `observations`.
Su acceso cross-área ocurre solo a través de las vistas `v_report_*`.

**Por qué.** La privacidad entre áreas fue el requisito declarado como más
importante. Si Reportes pudiera leer las tablas crudas "solo para analizar", el
sistema se convertiría en un panóptico interno y erosionaría la confianza de
los Directores de Marketing y Proyectos.

**Excepción única.** `risk_snapshots` sí es legible por Reportes: son niveles
de semáforo agregados, no contenido operativo.

---

## D5 · Contraseñas y sesiones fuera de nuestro esquema

**Decisión.** La tabla `users` es solo perfil de aplicación. Su `id` es el mismo
UUID que `auth.users.id` de Supabase. Contraseñas, MFA, tokens y sesiones los
gestiona Supabase Auth.

**Por qué.** Implementar hashing, rotación de refresh tokens y TOTP correctamente
es donde más fácil se cometen errores de seguridad. Supabase ya lo resuelve con
argon2id y MFA nativa.

**Consecuencia.** No existe tabla `sessions` propia. La expiración por
inactividad (30 min) y la duración de sesión (24 h) se configuran en Supabase,
no en código.

---

## D6 · Auditoría append-only reforzada en la base de datos

**Decisión.** `audit_log` tiene política de INSERT con `check (false)` y se
revocan `UPDATE`/`DELETE` a los roles `authenticated` y `anon`. La escritura
entra por un trigger `SECURITY DEFINER`.

**Por qué.** Una bitácora que la aplicación puede editar no es una bitácora. Al
cerrar la escritura directa, ni un bug ni una sesión comprometida pueden
reescribir el historial.

---

## D7 · La distinción prevalidar / aprobar vive en la capa de servicio

**Decisión.** RLS permite a Coordinador y Director de Área hacer `UPDATE` sobre
`initiative_inputs`. La regla de que el Coordinador solo prevalida (y no puede
mover el estado a `APPROVED`) se aplica en la capa de servicio.

**Por qué.** Expresar transiciones de estado por rol dentro de una política RLS
requiere condiciones sobre el valor entrante que se vuelven ilegibles y
frágiles. La capa de servicio es el lugar correcto para la máquina de estados;
RLS protege el perímetro de datos.

**Riesgo asumido.** Un bug en el servicio podría permitir una aprobación
indebida. Se mitiga concentrando toda transición en un único módulo con tests,
y con el registro en `initiative_input_transitions`.

---

## D8 · Las vistas de reporte no son accesibles desde el navegador

**Decisión.** `revoke all ... from public, anon, authenticated` sobre las 4
vistas `v_report_*`. Solo `service_role` (y, cuando exista, el rol dedicado de
Cinergia Core) puede leerlas.

**Por qué.** Una vista se ejecuta con los permisos de quien la creó, no de
quien la consulta — por eso RLS de `initiatives`, `tasks`, etc. no la protege.
Supabase otorga `SELECT` sobre todo objeto nuevo de `public` a `anon` y
`authenticated` por defecto. Sin este bloqueo, cualquier Miembro autenticado
podría leer el agregado de las 3 áreas vía la API REST, sin pasar por RLS.

**Consecuencia.** El dashboard de Director de Reportes no puede consultar
estas vistas directamente desde el cliente (Supabase JS en el navegador). Se
consultan desde un Server Component o Route Handler usando el `service_role`,
y el código del servidor verifica que la sesión sea `PRESIDENT` o
`REPORTS_DIRECTOR` antes de devolver cualquier dato. El control de acceso de
este caso específico vive en la aplicación, no en RLS — documentado aquí para
que quien lo lea no asuma que todo el sistema es RLS-only.

---

## Pendiente de definir

- **Estructura de `acta_templates.structure_schema`** para `EVENT` y `PROJECT`.
  Bloqueado hasta recibir las actas estandarizadas de ambas áreas.
- **Umbral de escalación**: sembrado en `app_settings` como S/ 2,000, ajustable
  por Presidencia sin desplegar código.
- **Proveedor de WhatsApp**: recomendado WhatsApp Business Cloud API (oficial).
  Sin implementar hasta Fase 3.

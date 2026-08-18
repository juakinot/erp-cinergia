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

## D9 · `prisma migrate dev` no funciona contra el pooler de Supabase — flujo manual de migraciones

**Decisión.** Los cambios de esquema posteriores al `init` se escriben a mano
como SQL, se aplican con `scripts/run-sql.mjs` (conexión directa, puerto 5432)
y se registran con `prisma migrate resolve --applied <nombre>`. No se vuelve
a invocar `prisma migrate dev` ni `--create-only` en este proyecto.

**Por qué.** `migrate dev` necesita crear una base de datos "shadow" efímera
para probar que las migraciones aplican limpio en secuencia. Contra el pooler
de Supabase, esa creación se queda colgada indefinidamente — probablemente el
rol de conexión no tiene privilegio `CREATEDB` en el servidor administrado.
Pasó dos veces en esta sesión, ambas hubo que matar el proceso a mano.

**Cómo agregar un cambio de esquema de aquí en adelante:**
1. Editar `prisma/schema.prisma`.
2. `npx prisma validate` — valida sintaxis sin tocar la base de datos.
3. Escribir a mano `prisma/migrations/<timestamp>_<nombre>/migration.sql`
   (mirar una migración anterior para el estilo de `ALTER TABLE`/`ADD
   CONSTRAINT` — Prisma es consistente, es mecánico de replicar).
4. `node scripts/run-sql.mjs prisma/migrations/<carpeta>/migration.sql`
5. `npx prisma migrate resolve --applied <timestamp>_<nombre>`
6. `npx prisma generate`

**Consecuencia.** La migración `init` incluye ahora `CREATE EXTENSION IF NOT
EXISTS "citext"` al principio (antes solo estaba activada manualmente desde
el dashboard de Supabase) — si algún día se logra levantar un shadow db que
sí funcione, esa migración ya es autocontenida y no fallará por falta de la
extensión.

---

## D10 · `id` necesita `DEFAULT gen_random_uuid()` real en la base de datos

**Decisión.** Todas las tablas con `id String @id @default(uuid())` (29 de
30 modelos — `users` es la excepción, su id viene de Supabase Auth) reciben
`ALTER COLUMN "id" SET DEFAULT gen_random_uuid()` a nivel de Postgres.

**Por qué.** `@default(uuid())` de Prisma genera el UUID **en el cliente de
Prisma**, antes de armar el INSERT — no crea un `DEFAULT` real en la columna.
Eso es invisible mientras todo pasa por Prisma Client, pero esta app escribe
datos operativos vía `supabase-js` con la sesión del usuario (para que RLS
decida, no `service_role` — ver D7), y ese camino no tiene forma de generar
el UUID del lado del cliente. Sin este `DEFAULT`, cualquier `insert()` vía
supabase-js fallaba con `null value in column "id"` — se detectó al probar
crear una iniciativa real desde el formulario, no en una revisión de código.

**El mismo problema apareció de nuevo con `updated_at`.** `@updatedAt` de
Prisma también se calcula en el cliente, en cada `UPDATE` que pasa por
Prisma Client — un `update()` vía supabase-js no lo toca. Se resolvió con
`DEFAULT now()` (valor inicial) más un trigger `BEFORE UPDATE` compartido
(`public.set_updated_at()`) en las 13 tablas que tienen esa columna — un
`DEFAULT` solo no basta porque no se re-ejecuta en cada `UPDATE`, y ese es
justamente el comportamiento que se necesita.

**Consecuencia práctica.** Cualquier tabla nueva que se agregue más adelante
necesita el mismo tratamiento — `DEFAULT gen_random_uuid()` en `id`, y si
tiene `updated_at`, sumarla al `DO $$ ... FOR t IN ...` del trigger — si
sus filas se van a crear o editar alguna vez vía supabase-js (que es casi
siempre, dado D7). Fácil de olvidar; vale la pena revisarlo en cada
migración nueva que agregue una tabla.

---

## D11 · El mailer por defecto de Supabase no sirve para invitar de verdad

**Decisión.** `inviteUserByEmail` (usado en `/usuarios/nuevo`) queda tal
cual, sin lógica adicional de reintentos ni fallback — el problema no está
en el código de la app.

**Por qué.** Al verificar el flujo con datos de prueba aparecieron dos
comportamientos separados, fáciles de confundir entre sí:

1. Supabase valida que el dominio del correo tenga registros de correo
   reales antes de aceptar la invitación. `nombre@test.cinergia.pe` (dominio
   ficticio de los seeds) y `nombre@example.com` (dominio reservado por la
   IANA, sin MX) fallan los dos con `"Email address ... is invalid"` — no es
   un bug, es intencional. Un Gmail real pasa esa validación sin problema.
2. Con un correo válido, la invitación choca con el límite de envíos del
   mailer compartido que Supabase da por defecto en proyectos nuevos
   (pensado solo para pruebas, unos pocos correos por hora): `"email rate
   limit exceeded"`.

Ambos casos se confirmaron sin dejar filas huérfanas — ni en `auth.users`
ni en `public.users` — así que el rollback de `inviteUser()` (ver
`src/app/usuarios/actions.ts`) funciona correctamente en ambos frentes.

**Consecuencia práctica.** Antes de invitar usuarios reales hace falta
configurar SMTP propio en Supabase (**Project Settings → Authentication →
SMTP Settings**) usando Resend (cuenta ya creada, ver
`docs/setup-infraestructura.md` §4) — host `smtp.resend.com`, usuario
`resend`, contraseña el `RESEND_API_KEY`. Es un cambio de configuración de
cuenta que le corresponde hacer a Presidencia desde el dashboard, no algo
que se resuelva por código.

---

## D12 · `redirectTo` de la invitación debe apuntar a `/auth/confirm`, no a la página final

**Decisión.** `inviteUserByEmail` usa
`redirectTo: ${NEXT_PUBLIC_APP_URL}/auth/confirm?next=/completar-registro`
— nunca la ruta final directamente.

**Por qué.** La primera versión apuntaba `redirectTo` directo a
`/completar-registro`. Con correo real (Gmail) y SMTP ya funcionando, el
enlace del correo sí abría la app, pero rebotaba a `/login` sin sesión —
sin que `/auth/confirm` recibiera ninguna petición (confirmado revisando
los logs del servidor: cero hits a esa ruta).

La causa: el enlace del correo apunta primero al endpoint de verificación
de **Supabase** (`https://<proyecto>.supabase.co/auth/v1/verify?...`), que
valida el token del lado de Supabase y recién *después* redirige a
`redirectTo`. Si `redirectTo` es la página final, Supabase no tiene forma
de dejar una sesión en una cookie httpOnly de nuestro dominio — el flujo
implícito solo puede pasar los tokens como fragmento de URL
(`#access_token=...`), que nunca llega al servidor. `/completar-registro`
es un Server Component que exige sesión vía cookie; sin ella, el
middleware redirige a `/login` antes de que cualquier JS del cliente
tuviera oportunidad de leer el fragmento.

Apuntar `redirectTo` a `/auth/confirm` en cambio sí funciona: esa ruta es
la que recibe el `code`/`token_hash` de Supabase, hace el intercambio del
lado del servidor (`verifyOtp` / `exchangeCodeForSession`), y es ahí —
dentro del propio Route Handler, no en el cliente — donde sí se puede
escribir la cookie de sesión httpOnly antes de redirigir a `next`.

**Ese cambio solo no bastó.** Con `redirectTo` ya apuntando a
`/auth/confirm`, el correo real seguía llegando a esa ruta sin ningún
`token_hash` ni `code` en la query string — porque la plantilla de correo
"Invite user" de Supabase, por defecto, usa `{{ .ConfirmationURL }}`, que
apunta primero al endpoint hospedado de Supabase
(`https://<proyecto>.supabase.co/auth/v1/verify?...`). Ese endpoint valida
el token y entrega la sesión como **fragmento de URL**
(`#access_token=...`, flujo implícito) — algo que un Route Handler nunca
puede leer, porque el fragmento no viaja al servidor. Hubo que editar la
plantilla en el dashboard (**Authentication → Emails → Templates → Invite
user**) para que el enlace apunte directo a nuestra ruta con el token como
parámetro real de servidor:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/completar-registro
```

**Consecuencia práctica.** Los dos cambios son necesarios juntos: (1)
`redirectTo` en `inviteUserByEmail` apuntando a `/auth/confirm?next=...`,
y (2) la plantilla de correo usando `{{ .TokenHash }}` en vez de
`{{ .ConfirmationURL }}`. Aplica a cualquier plantilla de Supabase Auth que
se llegue a usar (recuperar contraseña, cambio de correo, etc.) — cada una
necesita el mismo tratamiento en su propia plantilla. Verificado de
extremo a extremo el 2026-08-17 con un correo real (Gmail, vía Resend):
invitación → correo → clic → `/auth/confirm` → `/completar-registro` →
contraseña definida → login → rol y área correctos según `public.users`.
No habría aparecido revisando el código en aislamiento ni con los usuarios
de prueba (que nunca habían recibido un correo real hasta este punto).

---

## D13 · Invitar sin correo automático: `generateLink` en vez de `inviteUserByEmail`

**Decisión.** `inviteUser()` usa `admin.auth.admin.generateLink({ type:
'invite', email, ... })` en vez de `inviteUserByEmail`. La acción ya no
intenta enviar ningún correo — construye el enlace de invitación
(`/auth/confirm?token_hash=...&type=invite&next=/completar-registro`) a
partir de `data.properties.hashed_token` y lo devuelve al formulario, que
lo muestra con un botón de copiar en vez de redirigir a `/usuarios`.

**Por qué.** Resend, sin un dominio propio verificado, solo entrega
correos del remitente de pruebas (`onboarding@resend.dev`) a la dirección
dueña de la cuenta de Resend — no a terceros. Eso significa que
`inviteUserByEmail` solo funcionaba para invitarse a uno mismo; con
cualquier otra persona real fallaba con `"Error sending invite email"`.
Comprar y verificar un dominio (~S/40/año + propagación DNS) es la
solución de fondo, pero no bloqueante: mientras tanto, Presidencia genera
el enlace desde la app y lo entrega ella misma por el canal que prefiera
(WhatsApp, correo personal). La persona invitada de todas formas define su
propia contraseña sin que Presidencia la vea nunca — solo cambia quién
entrega el enlace inicial, no la garantía de privacidad de la contraseña.

**Consecuencia práctica.** Cuando haya un dominio verificado en Resend,
se puede volver a `inviteUserByEmail` (o mantener ambos: intentar el envío
automático y caer a mostrar el enlace si falla). El enlace generado por
`generateLink` es de un solo uso y expira igual que uno enviado por
correo — la política de expiración la controla Supabase, no el código de
la app.

---

## D14 · La verificación del token no puede pasar en un GET simple

**Decisión.** `/auth/confirm` dejó de ser un Route Handler que verifica el
token en el `GET` (`route.ts`). Ahora es una **página** (`page.tsx`) que
solo muestra un botón "Continuar"; la verificación real
(`verifyOtp`/`exchangeCodeForSession`) vive en un Server Action
(`confirmInvite`, en `actions.ts`) que solo se dispara con el `POST` que
genera un clic real en ese botón.

**Por qué.** Primer caso real de invitación a una persona fuera de este
equipo: Presidencia generó el enlace (ver D13) y lo mandó por WhatsApp. El
director nunca pudo completar el registro — le aparecía `/login`, enlace
inválido. La causa: WhatsApp **precarga la URL del lado del servidor**
apenas se envía el mensaje, para armar la tarjeta de vista previa (título,
imagen). Esa precarga es un `GET` idéntico a el que haría el navegador del
director — y como `/auth/confirm` verificaba el token en cualquier `GET`,
la precarga de WhatsApp gastó el token de un solo uso antes de que el
director llegara a tocar el enlace. Confirmado en `auth.users`: el
usuario tenía `last_sign_in_at` poblado — alguien (o algo) ya había
verificado el OTP — pero el director nunca vio `/completar-registro`.

Este es el mismo tipo de problema, en otro punto del sistema, que D12 ya
había encontrado con los rastreadores de Gmail — aquí el disparador es
WhatsApp en vez de Gmail, pero la causa raíz es la misma: **cualquier**
cliente puede hacer un `GET` pasivo sin que sea la persona. La solución
correcta no es detectar user-agents de rastreadores (frágil, hay
demasiados) sino no verificar nada hasta que haya una acción explícita del
lado del cliente — un `POST` real. Se probó con `curl` simulando 3 cargas
pasivas seguidas del mismo enlace (como haría una precarga) y el token
siguió vivo hasta el clic real en el navegador.

**Consecuencia práctica.** Cualquier ruta que verifique un token de un
solo uso — invitaciones, recuperar contraseña, cambio de correo — tiene
que seguir este mismo patrón: página con botón, Server Action que verifica
en el submit. Nunca verificar en un `GET`, sin importar qué tan simple
parezca el flujo.

---

## D15 · Reintentar una invitación con el mismo correo

**Decisión.** `inviteUser()` distingue dos casos al invitar: si
`generateLink({ type: 'invite' })` devuelve `error.code === 'email_exists'`,
se cae a `reissueLink()`, que usa `generateLink({ type: 'recovery' })` en
su lugar — funciona para una cuenta que ya existe en `auth.users`, y lleva
al mismo `/completar-registro`. Además, el `insert` de `public.users` pasó
a `upsert` en los dos caminos, porque una cuenta ya invitada antes puede
tener perfil pero no contraseña.

**Por qué.** Fabrizzio (el primer director real invitado, ver D14) quedó
con su cuenta de Auth confirmada por el bug de la precarga de WhatsApp,
pero sin contraseña. Al corregir D14 e intentar invitarlo de nuevo con el
mismo correo, `generateLink({ type: 'invite' })` rechazó con
`email_exists` — ese tipo solo sirve para convertir un correo *no
confirmado* en uno confirmado; una vez confirmado (aunque sea por
accidente, sin contraseña), ya no aplica. `type: 'recovery'` sí funciona
para cualquier cuenta existente, confirmada o no.

Al arreglar esto se encontró un problema relacionado en el propio código:
el camino original hacía `insert` (no `upsert`) en `public.users`, y si
fallaba por PK duplicada **borraba la cuenta de Auth entera** como
"rollback" — una cuenta ya existente (no creada en esa misma llamada)
podía desaparecer por un choque de escritura, no por ser inválida. Se
verificó en pruebas locales: ese rollback sí borró una cuenta de prueba
que no debía borrarse.

**Consecuencia práctica.** Ya no se borra ninguna cuenta de Auth como
efecto secundario de un error de perfil — si `upsert` falla (por ejemplo,
`area_id` inválido), se reporta el error y la cuenta de Auth queda intacta
para que Presidencia reintente sin haber perdido nada.

---

## D16 · Módulo de Tareas/Kanban: mover con botones, no arrastrar

**Decisión.** El tablero (`/iniciativas/[code]/tareas`) mueve tarjetas con
botones de acción por tarjeta ("Iniciar", "Enviar a revisión", "Bloquear",
"Completar", "Cancelar") — no con arrastrar-y-soltar. Cada botón visible
es exactamente una transición válida desde el estado actual, calculada con
el mismo grafo (`TASK_TRANSITIONS` en `src/lib/tasks/state-machine.ts`)
que valida el Server Action — la UI nunca ofrece un movimiento que el
servidor vaya a rechazar.

**Por qué.** Mismo criterio que ya usa el detalle de Iniciativas (botones
+ vista previa de validación, no una interfaz "libre"): más simple de
construir, más fácil de verificar con el navegador automatizado, y evita
la complejidad de reconciliar posiciones de arrastre con `KanbanCard.position`
bajo escritura concurrente. Arrastrar-y-soltar queda como mejora visual
futura, no como bloqueante.

**Reglas de negocio nuevas en `validateTaskTransition`:**
- Bloquear exige un motivo (no se puede bloquear sin explicar por qué).
- Completar una tarea de prioridad **Alta** o **Crítica**
  (`requires_approval = true`) solo lo puede hacer quien gestiona la
  iniciativa — la persona asignada puede llevarla hasta "En revisión",
  pero no autocompletarla. Sin esto, `requires_approval` era un campo del
  esquema sin ningún efecto real.
- `OVERDUE` (vencida) queda sin usar a propósito: nada la calcula ni
  asigna todavía — haría falta un job programado que compare `due_date`
  contra la fecha actual. Documentado como límite conocido, igual que
  Actas/Logística en `validateReady` (ver el comentario de esa función).

**Hueco de RLS cerrado de paso.** Antes de este módulo, cualquiera que
pudiera *ver* una iniciativa podía crear, mover o borrar tarjetas y
columnas del Kanban (`kanban_boards_all`, `kanban_columns_all`,
`kanban_cards_all` usaban `can_view_initiative` para *todo*, insert
incluido — ver `tasks_insert` también). Se separaron lectura (ver) de
escritura (gestionar), con un autoservicio explícito para que la persona
asignada mueva su propia tarjeta sin depender de `can_manage_initiative`.
Nunca se explotó — se encontró revisando el código antes de construir
encima, no en producción.

**Bug de autorización encontrado de paso.** La página de detalle de
Iniciativas calculaba `canActOnArea` sin incluir a `COORDINATOR`, pese a
que `can_manage_initiative` (RLS) y varios comentarios del propio
state-machine ("manual por CO/DA") sí le dan esa autoridad. Un Coordinador
no podía avanzar sus propias iniciativas desde la UI — solo verlas. Se
extrajo `canManageInitiative()` a `src/lib/initiatives/permissions.ts`
(espeja `can_manage_initiative()` de RLS) y se usa ahora en ambas páginas.

**Gotcha de PostgREST.** `kanban_cards.task_id` es `@unique` en Prisma (1
a 1 con `tasks`), pero como la FK vive en `kanban_cards` (relación
inversa desde `tasks`), PostgREST siempre lo embebe como arreglo
(`kanban_card: [...]`), nunca como objeto único — sin importar la
restricción unique. Se normaliza a objeto o `null` en `page.tsx`, antes
de pasarlo a los componentes de cliente. Se detectó porque el tablero
mostraba "Sin tareas" en todas las columnas pese a que la tarea sí
existía en la base — confirmado comparando la consulta directa (con
`service_role`, sin RLS) contra lo que renderizaba la página.

**Verificado con sesiones reales** (usuarios de prueba, `npm run
seed:test-users`): Director de Área crea una tarea de prioridad Alta y la
mueve por todo el flujo (Pendiente → En progreso → Bloqueada → En
progreso → En revisión); el Miembro asignado puede autoservicio-mover su
propia tarjeta pero no ve "Completar" (por `requires_approval`) ni
"Reasignar" (no gestiona la iniciativa); un intento directo de `insert`
en `tasks` saltándose la Server Action, como Miembro, es rechazado por
RLS (`tasks_insert` ahora exige `can_manage_initiative`).

---

## D17 · Módulo de Actas: formulario + flujo de aprobación, sin IA ni PDF todavía

**Decisión.** `/iniciativas/[code]/acta` cubre el ciclo completo que
desbloquea `validateReady` (D-comentario en `state-machine.ts`):
Borrador → En revisión → Aprobada → Publicada, más la firma extra de
Presidencia para `PROJECT`. **No** incluye generación asistida por IA
(`acta.generated_content`, `ai_model`) ni exportación a PDF
(`acta.pdf_url`) — decisión explícita del alcance, no un olvido: esos dos
campos no son necesarios para que una iniciativa avance de estado, y
construir la generación por IA merece su propia sesión (elegir el prompt
final, probarlo contra actas reales, decidir el formato del PDF).

**Autollenado real, no maquetado.** Cada plantilla (`src/lib/actas/templates.ts`)
marca el origen de cada campo (`FieldSource`): los que vienen de la
iniciativa, el equipo, los riesgos registrados o los hitos del calendario
se calculan solos al crear el acta (`src/lib/actas/autofill.ts`) y se
guardan tal cual en `input_data` — no se recalculan después, para que el
acta quede como una fotografía del momento en que se elaboró. Solo los
campos marcados `manual` piden que alguien escriba.

**Flujo de decisión, no calcado de RLS.** `actas_insert`/`actas_update`
en RLS permiten escribir a cualquiera que gestione la iniciativa
(Coordinador incluido) — igual que con Tareas (D7: RLS protege el
perímetro, no la lógica de negocio). La regla real vive en
`src/lib/actas/state-machine.ts`: cualquier gestor puede redactar y
enviar a revisión, pero pasar de "En revisión" a "Aprobada" (o devolver a
borrador) exige ser Director de Área o Presidencia — un Coordinador no se
autoaprueba su propia acta.

**Firma de Presidencia como paso aparte, no como parte de "Aprobar".**
Para `PROJECT` (`requiresPresidencySignature: true` en la plantilla), el
acta puede llegar a `APPROVED` sin que Presidencia haya firmado —
`validateReady` exige las dos cosas por separado (`status` Y
`presidency_approved_at`). "Publicar" queda bloqueado hasta que exista la
firma. Verificado con sesiones reales el 2026-08-17: con Director de
Proyectos, el acta llegó a `APPROVED` y la iniciativa se quedó bloqueada
con el mensaje exacto de `validateReady` ("...también requiere la firma
de Presidencia..."); tras firmar como Presidencia, el mismo botón
"Avanzar a Listo para ejecución" se desbloqueó sin recargar código, solo
con el cambio de estado en la base.

---

## D18 · Pasada de diseño visual: tokens del wireframe, no una paleta nueva

**Decisión.** `src/app/globals.css` deja de ser el CSS por defecto de
`create-next-app` y pasa a tener, literal, los custom properties de
**Wireframes v3** (el artifact publicado en la fase de diseño) — mismos
hex, mismos nombres de variable (`--brand-primary`, `--surface-panel`,
`--alert-warn`, etc.), modo oscuro incluido vía
`@media (prefers-color-scheme: dark)`. Se agregó `src/components/app-shell.tsx`
(sidebar oscura + topbar, antes inexistente — cada página armaba su propio
encabezado suelto sin nada en común) y `src/components/breadcrumb.tsx`
(migas de pan con chip de código + badge de estado, reemplaza los enlaces
"← volver" sueltos de las subpáginas de una iniciativa). Ambos se aplican
en las 8 páginas autenticadas.

**Por qué.** El código funcionaba pero no se parecía al wireframe — el
motivo no era la paleta (los hex ya coincidían, se habían tomado del
mismo documento desde el principio) sino la ausencia total de shell:
sin sidebar ni topbar persistentes, cada pantalla se sentía como un
formulario aislado en vez de un sistema. Se recuperó el wireframe
publicado (vía `Artifact list` + `WebFetch`, no de memoria) para copiar
los valores exactos en vez de aproximarlos.

**Gotcha real encontrado en el camino.** El primer intento de la página
de inicio usaba clases (`event-card`, `event-list`, `rail`, etc.) que
nunca se definieron en `globals.css` — quedaron sin ningún estilo
(`display: inline`, sin fondo) y el navegador las colapsó en texto
corrido, sin ningún error de build ni de consola. Se detectó comparando
`getComputedStyle()` del elemento real contra lo esperado, no leyendo el
código — un className que no rompe nada al compilar puede seguir sin
tener ninguna regla detrás.

**Alcance de esta pasada.** Se tocó la estructura de cada página (shell,
migas de pan, paneles, insignias de estado, tablas) y los botones
principales de los formularios grandes — no cada micro-componente cliente
(por ejemplo, `ActionButton`/`CancelButton` de Iniciativas o el editor de
campos del acta siguen con clases de Tailwind en hex, que ya coinciden
con los tokens en valor aunque no en abstracción). Arrastrar-y-soltar en
el Kanban, iconografía real y las pantallas específicas por rol del
wireframe (ejecutiva, Radar, Ideación — módulos que todavía no existen en
el código) quedan fuera, consistente con D16: no construir interfaz para
módulos que el sistema aún no tiene.

---

## D19 · El botón de confirmar invitación necesita deshabilitarse solo

**Decisión.** `src/app/auth/confirm/confirm-button.tsx` usa
`useFormStatus()` de `react-dom` para deshabilitarse y mostrar
"Confirmando…" mientras el Server Action `confirmInvite` corre — sin
convertir toda la página de confirmación a Client Component (el resto
sigue siendo un Server Component normal; `useFormStatus` funciona dentro
de cualquier `<form action={serverAction}>` sin importar dónde vive el
form en el árbol).

**Por qué.** Un director real completó su registro con éxito — quedó
`last_sign_in_at` real en la base, contraseña guardada — pero terminó
viendo la pantalla de login, no la de "bienvenido". El botón "Continuar"
(D14) no se desactivaba tras el primer clic; un doble clic/doble tap
mandaba dos POST casi simultáneos al mismo Server Action: el primero
gastaba el token de un solo uso con éxito y redirigía a
`/completar-registro`, el segundo llegaba justo después, encontraba el
token ya consumido, y su propio `redirect('/login?error=enlace_invalido')`
ganaba la carrera — devolviendo a la persona al login inmediatamente
después de haber terminado. Se reprodujo el patrón revisando
`confirmed_at`/`last_sign_in_at` en `auth.users` (casi idénticos, a
milisegundos de diferencia) antes de tocar el código.

**Consecuencia práctica.** Mismo riesgo aplica a cualquier botón que
dispare un Server Action de un solo uso (tokens, pagos, transiciones no
idempotentes) — deshabilitar en el primer clic con `useFormStatus()` (o
el `pending` de `useTransition` en los botones que ya usan ese patrón)
no es opcional, es la defensa real contra doble-tap en móvil.

---

## D20 · Módulo de Logística: checklist sin autoservicio de terceros

**Decisión.** `/iniciativas/[code]/logistica` cubre lo que
`validateReady` exige para Eventos: crear el checklist, agregar ítems
(categoría, descripción, obligatorio, requiere evidencia), y marcar cada
uno `PENDING → DONE` o `PENDING → NOT_APPLICABLE` (con motivo
obligatorio). A diferencia de Tareas (D16), la escritura queda
completamente reservada a quien gestiona la iniciativa — sin
autoservicio de un tercero — porque `LogisticsItem` no tiene un campo de
responsable asignado de antemano, solo `done_by_user_id` (se llena recién
al completar). Inventar un campo de asignación nuevo solo para calcar el
patrón de Tareas habría sido construir por simetría, no por necesidad.

**Bug real encontrado y corregido de paso.** `validateReady` solo
aceptaba `status === 'DONE'` como resuelto — un ítem obligatorio marcado
`NOT_APPLICABLE` (que existe justo para "esto no aplica a este evento en
particular", con su propio campo `notApplicableReason` para justificarlo)
seguía bloqueando el avance igual que uno sin tocar. Se cambió a aceptar
cualquier cosa que no sea `PENDING`. Se encontró leyendo el código antes
de construir la UI encima, no en producción — mismo patrón que el hueco
de RLS de D16.

**Hueco de RLS cerrado de paso.** `logistics_checklists_all` y
`logistics_items_all` tenían el mismo problema que Kanban antes de D16:
una sola política `for all` gateada solo por `can_view_initiative` —
cualquiera que pudiera *ver* la iniciativa podía escribir. Se separó
lectura de escritura, escritura ahora exige `can_manage_initiative`.
Verificado con una sesión real de Miembro: un `insert` directo a
`logistics_items`, saltándose la UI, es rechazado por RLS.

**Consecuencia práctica.** El checklist no se auto-genera con las 6
categorías sugeridas del comentario del esquema (permisos, materiales,
difusión, catering, seguridad, tecnología) — se ofrecen como sugerencias
en un `<datalist>`, pero cada ítem se agrega a mano. Generar un checklist
estándar por defecto queda como posible mejora futura, no bloqueante.

---

## Pendiente de definir

- **Umbral de escalación**: sembrado en `app_settings` como S/ 2,000, ajustable
  por Presidencia sin desplegar código.
- **Proveedor de WhatsApp**: recomendado WhatsApp Business Cloud API (oficial).
  Sin implementar hasta Fase 3.
- **Generación de Actas por IA y exportación a PDF** (D17): alcance
  explícitamente diferido, no implementado.

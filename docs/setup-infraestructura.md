# Guía de infraestructura — ERP CINERGIA

Pasos para dejar el proyecto conectado a una base de datos real. Todo lo que
aparece aquí tiene nivel gratuito suficiente para CINERGIA; el costo esperado
es de USD 0 hasta bien entrado el segundo año.

**Estos pasos los haces tú, no yo.** Implican crear cuentas y manejar
contraseñas, y no debo hacer eso en tu nombre. Cuando termines, avísame y sigo
con las migraciones.

---

## 1 · GitHub (5 minutos)

1. Crea un repositorio **privado** llamado `erp-cinergia` en tu cuenta.
   No marques "Add a README" — ya existe historial local.
2. Copia la URL del repositorio.
3. Avísame y yo conecto el remoto y subo el historial.

> **Privado, no público.** El repositorio no contiene credenciales, pero sí
> revela la estructura completa del sistema y sus reglas de permisos.

---

## 2 · Supabase (15 minutos)

### Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y regístrate con GitHub.
2. **New project**:
   - **Name**: `erp-cinergia`
   - **Database Password**: genera una larga y aleatoria. **Guárdala en un
     gestor de contraseñas antes de continuar** — Supabase no la vuelve a mostrar.
   - **Region**: `South America (São Paulo)` — es la más cercana a Lima.
   - **Plan**: Free.
3. El aprovisionamiento tarda ~2 minutos.

### Copiar las credenciales

En **Project Settings → Database → Connection string**, modo **URI**:

- **Transaction pooler** (puerto 6543) → va en `DATABASE_URL`
- **Session pooler** (puerto 5432) → va en `DIRECT_URL`

En **Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

### Configurar autenticación

En **Authentication → Providers**:
- Deja **Email** activado. Desactiva el resto.
- Activa **Confirm email**.

En **Authentication → Sessions**:
- **JWT expiry**: `1800` (30 minutos de inactividad).
- **Refresh token rotation**: activado.

> La expiración de sesión de la especificación se configura aquí, no en código.

### Habilitar la extensión citext

En **SQL Editor**, ejecuta:

```sql
create extension if not exists citext;
```

El esquema usa `citext` para los correos, de modo que `Ana@ucsur.pe` y
`ana@ucsur.pe` sean la misma cuenta.

---

## 3 · Archivo .env (2 minutos)

En la raíz del proyecto:

```bash
cp .env.example .env
```

Abre `.env` y pega los valores del paso 2.

> `.env` ya está en `.gitignore`. Si alguna vez lo subes por accidente, **rota
> todas las claves en Supabase** — borrar el commit no las invalida, quedan en
> el historial de git para siempre.

---

## 4 · Resend, para los correos (5 minutos)

1. Regístrate en [resend.com](https://resend.com) — 3,000 correos al mes gratis.
2. **API Keys → Create** → copia a `RESEND_API_KEY`.
3. Sin dominio propio puedes usar el remitente de pruebas de Resend, pero solo
   envía a tu propia dirección. Para notificar al equipo hace falta verificar un
   dominio: si CINERGIA no tiene uno, un `.pe` cuesta ~S/ 40 al año y sirve
   también para la URL del sistema.

---

## 5 · Vercel, para el despliegue (5 minutos)

Déjalo para cuando haya algo que mostrar. Cuando llegue el momento:

1. Regístrate en [vercel.com](https://vercel.com) con GitHub.
2. Importa el repositorio `erp-cinergia`.
3. Copia todas las variables de `.env` en **Settings → Environment Variables**.

---

## Qué hago yo cuando termines

1. `npx prisma migrate dev` — crea las 30 tablas.
2. Aplico `01_rls_policies.sql` — activa el aislamiento por área.
3. Aplico `02_report_views.sql` — crea las vistas de reporte.
4. Siembro las 3 áreas, las plantillas de acta y el umbral de escalación.
5. Verifico el aislamiento con usuarios de prueba de cada rol: que un Director
   de Marketing efectivamente **no pueda** leer datos de Proyectos ni forzando
   la consulta.

Ese último paso es el que confirma que la privacidad entre áreas funciona de
verdad y no solo en la interfaz.

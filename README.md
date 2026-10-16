# wallet-management-backend

API REST para **Mi Billetera** ([wallet-management-frontend](https://github.com/444jean/wallet-management-frontend)).

**Stack:** NestJS 12 · PostgreSQL 17 · Prisma 7 · Better Auth · Zod · Vitest

## Puesta en marcha

Requisitos: Node 22+, pnpm y un proyecto en [Supabase](https://supabase.com) (se usa solo como PostgreSQL; la autenticación la maneja Better Auth en esta API).

```bash
pnpm install          # también genera el cliente de Prisma
# crea el archivo .env (ver tabla abajo)
pnpm db:deploy        # crea las tablas en Supabase
pnpm start:dev        # http://localhost:3000/api
```

### Conexión a Supabase

En el dashboard: **Connect → ORMs / Connection string**.

- `DATABASE_URL` → **Session pooler** (`...pooler.supabase.com:5432`). La API es un servidor persistente, así que usa modo sesión (el modo transacción, puerto 6543, es para serverless).
- `DIRECT_URL` → la misma URL del session pooler, o la conexión directa (`db.<ref>.supabase.co:5432`, solo IPv6) agregando `?sslmode=require`. La usa Prisma para las migraciones.
- `DATABASE_CA_CERT` → **Project Settings → Database → SSL Configuration → Download certificate**. Pega el contenido PEM (en una línea con `\n` si tu hosting no acepta multilínea). Con él la API verifica el certificado del servidor; es obligatorio con `NODE_ENV=production`.
- Activa también **Enforce SSL on incoming connections** en la misma sección.

Usa una contraseña de base de datos larga y aleatoria, y no compartas estas URLs.

### Variables de entorno (`.env`)

| Variable             | Ejemplo                                                          | Descripción                                            |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`       | `postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres` | Conexión de la app (session pooler) |
| `DIRECT_URL`         | igual que arriba + `?sslmode=require`                             | Conexión para `prisma migrate`                         |
| `DATABASE_CA_CERT`   | `-----BEGIN CERTIFICATE-----\n...`                               | CA de Supabase; obligatorio en producción              |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`                                        | Secreto para firmar sesiones (mín. 32 caracteres)      |
| `BETTER_AUTH_URL`    | `http://localhost:3000`                                          | URL pública de esta API                                |
| `FRONTEND_URLS`      | `http://localhost:5173`                                          | Orígenes permitidos (CORS + Better Auth), separados por coma |
| `PORT`               | `3000`                                                           | Opcional                                               |
| `APP_TIMEZONE`       | `America/Santiago`                                               | Opcional; define "hoy" / "mes actual" para el sueldo   |
| `NODE_ENV`           | `development`                                                    | En `production` las cookies usan `SameSite=None; Secure` |

Las variables se validan al arrancar (`src/config/env.ts`); si falta alguna, la app no inicia.

## Scripts

| Script                  | Qué hace                                         |
| ----------------------- | ------------------------------------------------ |
| `pnpm start:dev`        | Servidor con watch                               |
| `pnpm build` / `pnpm start:prod` | Compilar / ejecutar `dist/`             |
| `pnpm db:migrate`       | Crear/aplicar migraciones (usa un *shadow database* temporal; ojo, apunta a Supabase) |
| `pnpm db:deploy`        | Aplicar migraciones en producción                |
| `pnpm db:studio`        | Prisma Studio                                    |
| `pnpm test` / `test:e2e`| Tests unitarios / e2e (e2e requiere la BD)       |
| `pnpm typecheck` / `lint` | TypeScript / oxlint                            |

## Autenticación

[Better Auth](https://www.better-auth.com/) con email + contraseña, montado en `/api/auth/*`. La sesión viaja en una cookie httpOnly, así que el frontend debe enviar `credentials: "include"`. Lo más simple es usar el cliente oficial:

```ts
// frontend
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({ baseURL: "http://localhost:3000" });
// authClient.signUp.email({ name, email, password })
// authClient.signIn.email({ email, password })
// authClient.signOut() · authClient.useSession()
```

Todas las rutas requieren sesión (guard global) salvo `GET /api/health`.

## API

Montos en **CLP enteros**; fechas `YYYY-MM-DD`; meses `YYYY-MM`. Los cuerpos y respuestas usan los mismos tipos que `src/types/index.ts` del frontend (`Transaction`, `SavingsGoal`, `SalaryConfig`, `FinanceData`).

| Método   | Ruta                     | Descripción |
| -------- | ------------------------ | ----------- |
| `GET`    | `/api/health`            | Estado de la API y la BD (público) |
| `GET`    | `/api/finance`           | Snapshot completo `{ transactions, goals, salary }` (= `FinanceData`) |
| `POST`   | `/api/finance/import`    | Importa el blob de `localStorage` (`wallet-management:data:v1`). Si la cuenta ya tiene datos responde `409` salvo que envíes `"replace": true` |
| `DELETE` | `/api/finance`           | Borra todos los datos del usuario (`resetAll`) |
| `GET`    | `/api/transactions`      | Lista; filtros opcionales `from`, `to`, `type`, `category`, `goalId` |
| `GET`    | `/api/transactions/:id`  | Detalle |
| `POST`   | `/api/transactions`      | Crea `{ type, amount, category, description, date, goalId? }` |
| `PATCH`  | `/api/transactions/:id`  | Actualiza parcial |
| `DELETE` | `/api/transactions/:id`  | Elimina (`204`) |
| `GET`    | `/api/goals`             | Lista metas de ahorro |
| `GET`    | `/api/goals/:id`         | Detalle |
| `POST`   | `/api/goals`             | Crea `{ name, target, current?, monthlyContribution?, annualRate?, deadline? }` |
| `PATCH`  | `/api/goals/:id`         | Actualiza parcial |
| `DELETE` | `/api/goals/:id`         | Elimina; sus aportes quedan como gastos normales (`204`) |
| `GET`    | `/api/salary`            | `{ salary: SalaryConfig \| null }` |
| `PUT`    | `/api/salary`            | Crea/actualiza `{ amount, category, description, day, since }` |
| `DELETE` | `/api/salary`            | Deja de generar sueldos; el historial se mantiene (`204`) |

Errores de validación → `400` con `{ message, errors: { formErrors, fieldErrors } }`.

### Reglas de negocio (antes en el frontend)

- **Aportes a metas:** una transacción con `goalId` debe ser `expense`; crearla suma `amount` a `goal.current`, editarla revierte el monto anterior y aplica el nuevo, eliminarla lo resta (`current` nunca baja de 0). Todo dentro de una transacción de BD.
- **Sueldo recurrente:** `GET /api/finance`, `GET /api/transactions` y `PUT /api/salary` generan los ingresos de sueldo faltantes desde `since` hasta el mes actual (máx. 24 meses atrás, día limitado al último del mes). Un índice único `(userId, salaryMonth)` evita duplicados. Al cambiar el sueldo se actualiza el del mes en curso; los meses anteriores quedan como historial.
- **Estadísticas y proyección de ahorro** siguen calculándose en el frontend a partir de los datos.

## Estructura

```
src/
  main.ts / app.module.ts
  config/env.ts            validación de variables de entorno
  prisma/                  PrismaClient compartido (Nest + Better Auth)
  auth/auth.ts             configuración de Better Auth
  common/                  fechas, pipe de Zod, esquemas comunes
  transactions/ goals/ salary/ finance/
  generated/prisma/        cliente generado (ignorado en git)
prisma/
  schema.prisma            modelos
  migrations/
```

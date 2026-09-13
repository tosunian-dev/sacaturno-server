<div align="center">

### API REST del backend de SacaTurno

[![Live API](https://img.shields.io/badge/deploy-Railway-black?style=flat-square&logo=railway)](https://sacaturno.com.ar)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongoosejs.com/)

[Frontend](https://github.com/leatosunian/sacaturno-frontend) · [sacaturno.com.ar](https://sacaturno.com.ar)

</div>

---

## Acerca del repositorio

API REST en **Express + TypeScript** que sostiene [SacaTurno](https://sacaturno.com.ar), un SaaS de gestión de turnos para negocios de servicios en Argentina (peluquerías, barberías, spas, etc.). Maneja usuarios, negocios, empleados, sucursales, agenda, turnos, suscripciones y dos integraciones separadas de Mercado Pago (suscripciones de la plataforma y señas de clientes).

Consumido por el [frontend en Next.js](https://github.com/leatosunian/sacaturno-frontend). Desplegado en Railway; base de datos en MongoDB Atlas.

## Funcionalidades principales

- **Autenticación** con JWT (login propio y Google OAuth), bcrypt para contraseñas con rehash progresivo de costo
- **Gestión de negocios**: perfil público, rubro/especialidad, horarios, sucursales
- **Empleados**: cuentas propias con permisos granulares, asignación a sucursales
- **Agenda y turnos**: generación automática de slots por cron, reserva, cancelación (con o sin reembolso de seña), reprogramación
- **Mercado Pago — señas**: cada negocio conecta su propia cuenta vía OAuth Marketplace; el cobro de la seña va directo a su cuenta, con webhook idempotente y verificación de firma HMAC
- **Mercado Pago — suscripciones SaaS**: cobro de los planes propios de SacaTurno (Básico / Pro / Full) a los negocios, con cron de expiración y recordatorios por email
- **Emails transaccionales** vía Resend (confirmaciones, recordatorios, recuperación de contraseña, vencimiento de plan) con una plantilla HTML unificada
- **Panel interno de plataforma: analytics globales de uso, activación y revenue para el dueño del SaaS, con su propio esquema de auth y JWT
- **Rate limiting** por IP y por email en endpoints públicos sensibles (login, registro, recuperación de contraseña)
- **Subida de imágenes** (perfil, logos) a Cloudinary vía Multer

## Stack técnico

| Área | Tecnología |
|---|---|
| Runtime / framework | Node.js + Express |
| Lenguaje | TypeScript |
| Base de datos | MongoDB + Mongoose |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Pagos | SDK oficial de Mercado Pago |
| Emails | Resend |
| Imágenes | Cloudinary + Multer |
| Jobs programados | node-cron |
| Seguridad | Helmet, express-rate-limit, CORS |
| Google OAuth | google-auth-library |
| Tests | Jest + ts-jest |

## Arquitectura

Patrón MVC en tres capas, todo bajo `src/`:

```
src/
├── app.ts              # Setup de Express, CORS, montaje de rutas, arranque de crons
├── config/db.ts        # Conexión a MongoDB
├── controllers/        # Manejan el request/response, delegan a services
├── services/           # Lógica de negocio, queries y llamadas a APIs externas
├── routes/             # Definición de endpoints (Express Router)
├── models/             # Schemas de Mongoose
├── interfaces/         # Interfaces TS calcadas de los schemas
├── middlewares/        # Auth (JWT), rate limiting, subida de archivos
└── utils/              # JWT, hashing, manejo de errores, cron jobs, firma de webhooks
```

Flujo de un request: `routes/* → controllers/* → services/* → base de datos / API externa`.

## Endpoints (bajo `/api`)

| Prefijo | Descripción |
|---|---|
| `/user` | Registro, login (email/Google), recuperación de contraseña, verificación |
| `/business` | CRUD de negocios, sucursales, empleados |
| `/appointment` | Reserva, cancelación y consulta de turnos |
| `/schedule` | Horarios y plantillas de agenda |
| `/subscription` | Planes pagos de SacaTurno y su cobro por Mercado Pago |
| `/mp` | OAuth de Mercado Pago del negocio + creación de preferencia y webhook de señas |
| `/superadmin` | Analytics de plataforma para `/backstage` (acceso restringido) |

## Modelos de datos

`User`, `Business` (con `mpAccessToken`/`mpRefreshToken` protegidos con `select: false`), `Employee`, `Branch`, `Service` (con `depositAmount`), `Appointment` (con `depositStatus`, `mpPaymentID`), `CancelledAppointment`, `AppointmentSchedule`, `DaySchedule`, `Subscription`, `PlanPayment`, `PlanPricing`, `PlatformAdmin`.

## Decisiones de diseño destacadas

- **Dos integraciones de Mercado Pago totalmente separadas** (credenciales, webhook y secreto de firma propios): una para las suscripciones que SacaTurno cobra a los negocios, otra —marketplace/OAuth— para que cada negocio cobre sus propias señas sin que el dinero pase por SacaTurno.
- **Webhooks idempotentes y firmados**: cada notificación de Mercado Pago valida su firma HMAC-SHA256 contra el manifest antes de tocar la base de datos, y chequea el `mpPaymentID` existente para no procesar el mismo pago dos veces.
- **Refresh de token automático**: si una llamada a la API de Mercado Pago devuelve 401, el backend refresca el token del negocio y reintenta una vez antes de fallar.
- **Rate limiting por scope**: cada sistema de auth (usuarios de negocio vs. superadmin) tiene sus propias instancias de limiter para que un ataque de fuerza bruta contra uno no consuma la cuota del otro.
- **Costo de bcrypt ajustable sin migración**: el costo queda embebido en cada hash, así que subirlo no invalida las contraseñas existentes; se re-hashean progresivamente en el próximo login exitoso.
- **Cron jobs** (zona horaria `America/Argentina/Buenos_Aires`): expiración de suscripciones y aviso de renovación a la 01:30, generación automática de turnos futuros a partir de las plantillas de agenda a las 03:10.
- **Campos de modelo siempre opcionales con default**: para no romper documentos existentes al agregar funcionalidad nueva.

## Poner el proyecto a correr localmente

```bash
git clone https://github.com/tosunian-dev/sacaturno-server.git
cd sacaturno-server
npm install
```

Crear un archivo `.env` en la raíz:

```bash
MONGO_URL=
JWT_SECRET=                     # requerido, el proceso no arranca sin esto
SUPERADMIN_JWT_SECRET=          # requerido, secreto separado para el panel de plataforma
FRONTEND_URL=http://localhost:3000
SERVER_URL=http://localhost:4000

# Mercado Pago — suscripciones de la plataforma
ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

# Mercado Pago — OAuth marketplace / señas de clientes
MP_MARKETPLACE_CLIENT_ID=
MP_MARKETPLACE_CLIENT_SECRET=
MP_MARKETPLACE_ACCESS_TOKEN=
MP_MARKETPLACE_WEBHOOK_SECRET=
MP_OAUTH_REDIRECT_URI=
BACKEND_PROD_URL=

# Email transaccional
RESEND_API_KEY=

# Cloudinary
CLOUDINARY_URL=

# Google OAuth
GOOGLE_CLIENT_ID=
```

```bash
npm run dev      # nodemon en http://localhost:4000
npm run build    # compila TypeScript a /dist
npm start        # corre el build compilado
```

> Necesita el [frontend](https://github.com/leatosunian/sacaturno-frontend) corriendo en paralelo en `http://localhost:3000`.

## Repos relacionados

- 🔗 **Frontend** (Next.js): [sacaturno-frontend](https://github.com/leatosunian/sacaturno-frontend)

---

<div align="center">

Hecho por [Leandro Tosunian](https://github.com/tosunian-dev)

</div>

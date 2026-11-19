# Claros Auto

Claros Auto es una aplicación web para apoyar la administración de un taller automotriz. Este avance conecta el catálogo público con una API Express y agrega persistencia PostgreSQL para clientes, vehículos, servicios y solicitudes de citas.

## Tecnologías

- **Frontend:** React, TypeScript, Vite, Tailwind CSS y React Router.
- **Backend:** Node.js, Express 5 y TypeScript.
- **Persistencia:** PostgreSQL, Prisma ORM 7 y el adaptador `pg`.
- **Validación HTTP:** Zod, CORS de orígenes permitidos y límite de solicitudes para registrar citas.
- **Calidad:** ESLint, Prettier, Vitest y Supertest.

## Estructura

```text
backend/
├── prisma/                 # Esquema, migraciones y datos iniciales de servicios
└── src/
    ├── config/             # Prisma y configuración de la API
    ├── middleware/         # Errores HTTP
    ├── modules/            # Rutas, controladores, servicios y repositorios
    ├── routes/             # Health check
    ├── scripts/            # Diagnóstico de conexión a PostgreSQL
    ├── app.ts              # Aplicación Express exportada para pruebas
    └── server.ts           # Inicio del servidor
frontend/src/
├── components/             # Catálogo, formulario y componentes compartidos
├── pages/                  # Inicio, servicios y solicitudes de cita
├── services/api.ts         # Cliente HTTP
├── types/                  # Tipos compartidos de interfaz
└── utils/                  # Validación del formulario
docs/
├── arquitectura.md
└── modelo-datos.json
```

## Requisitos e instalación

- Node.js 22 o posterior.
- npm 10 o posterior.
- PostgreSQL 14 o posterior (local o compatible, por ejemplo Supabase o Neon).

Desde la raíz del repositorio:

```bash
npm ci
npm --prefix frontend ci
npm --prefix backend ci
```

Configura la API y la base de datos copiando la plantilla:

```bash
cp backend/.env.example backend/.env
```

En PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Define `DATABASE_URL` en `backend/.env`, por ejemplo para PostgreSQL local:

```dotenv
DATABASE_URL="postgresql://USUARIO:CONTRASENA@localhost:5432/claros_auto?schema=public"
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

Usa credenciales propias fuera del control de versiones. Para proveedores administrados, usa el URL de conexión PostgreSQL que proporciona el proveedor y sus parámetros TLS/pooling. `DATABASE_URL` solo se usa en el backend. El cliente web usa `VITE_API_URL=/api` y el proxy de Vite reenvía esas rutas a `http://localhost:3000` durante el desarrollo.

## Base de datos y migraciones

Con PostgreSQL accesible y `DATABASE_URL` configurada, aplica las migraciones versionadas:

```bash
npm --prefix backend run db:migrate:deploy
npm --prefix backend run db:seed
```

El seed inserta o actualiza los seis servicios públicos por su `slug`; se puede ejecutar más de una vez. Para crear una migración durante el desarrollo después de editar `backend/prisma/schema.prisma`:

```bash
npm --prefix backend run db:migrate:dev -- --name descripcion_del_cambio
```

Utilidades disponibles:

```bash
npm --prefix backend run db:validate
npm --prefix backend run db:generate
npm --prefix backend run db:migrate:status
npm --prefix backend run db:check
```

El modelo y sus relaciones se documentan en [docs/arquitectura.md](docs/arquitectura.md) y en el JSON válido [docs/modelo-datos.json](docs/modelo-datos.json).

## Ejecución local

Abre dos terminales desde la raíz:

```bash
npm --prefix backend run dev
```

```bash
npm --prefix frontend run dev
```

La web suele estar en `http://localhost:5173` y la API en `http://localhost:3000`. Comprueba el estado en `http://localhost:3000/api/health`.

## API

### `GET /api/health`

Comprueba que el proceso de API está activo. No prueba conectividad PostgreSQL.

### `GET /api/servicios`

Devuelve servicios activos sin datos privados.

```json
{
  "data": [
    {
      "id": "id-del-servicio",
      "slug": "cambio-aceite",
      "name": "Cambio de aceite",
      "description": "Servicio de aceite y filtro."
    }
  ]
}
```

### `POST /api/citas`

Registra una solicitud con estado inicial `PENDIENTE`. La fecha debe ser ISO 8601 con zona horaria y estar en el futuro.

```json
{
  "name": "María López",
  "phone": "+504 9999 0000",
  "email": "maria@example.com",
  "vehicleMake": "Toyota",
  "vehicleModel": "Corolla",
  "vehicleYear": 2020,
  "serviceId": "id-del-servicio",
  "requestedAt": "2030-05-20T16:30:00.000Z",
  "notes": "Revisar los frenos."
}
```

Responde `201 Created` con la cita y un `lookupToken` aleatorio que se muestra una sola vez. Conserva este token para consultarla. Solo se guarda en PostgreSQL su hash SHA-256.

### `GET /api/citas/:id`

Devuelve estado, fechas y servicio; no incluye nombre, teléfono ni correo del cliente. Requiere el token privado en `Authorization: Bearer <lookupToken>`. Las respuestas de citas usan `Cache-Control: no-store`. No hay endpoint público para listar citas.

El endpoint público de creación tiene un límite de 10 solicitudes cada 15 minutos por origen de red. Configura los orígenes web en `CORS_ORIGIN`, separados por coma.

## Verificaciones

Desde la raíz:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

Las pruebas HTTP de citas usan una persistencia simulada para comprobar rutas, validación, respuestas, token y protección sin requerir PostgreSQL. Las migraciones se pueden aplicar y comprobar contra una instancia PostgreSQL local o de prueba; nunca apuntes pruebas destructivas a producción.

## Alcance y limitaciones actuales

- El catálogo y el formulario usan la API y guardan solicitudes cuando hay una base accesible y migrada.
- La disponibilidad de una hora no se confirma automáticamente; el taller debe confirmar la solicitud.
- La consulta usa un token privado entregado al crear la solicitud. Aún no hay autenticación administrativa ni recuperación de tokens.
- No se incluyen facturación, inventario, órdenes de trabajo, roles, notificaciones ni pagos.

## Código de verificación académica

`LEARN-CAP-AAF98C6D`

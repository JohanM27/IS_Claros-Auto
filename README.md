# Claros Auto

Claros Auto es una aplicación web para apoyar la administración de un taller automotriz. El sistema ofrece un catálogo público, solicitudes de citas guardadas en Supabase PostgreSQL, inicio de sesión de empleados con Supabase Auth y un panel inicial para recepción y administración.

## Tecnologías

- **Frontend:** React, TypeScript, Vite, Tailwind CSS y React Router.
- **Backend:** Node.js, Express 5 y TypeScript.
- **Persistencia:** PostgreSQL, Prisma ORM 7 y el adaptador `pg`.
- **Autenticación:** Supabase Auth en el navegador; Express verifica cada token con Supabase y obtiene el rol desde `StaffProfile`.
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
├── pages/                  # Sitio público, login y panel administrativo
├── auth/                   # Sesión de empleado con Supabase Auth
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
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE
```

Usa credenciales propias fuera del control de versiones. Para proveedores administrados, usa el URL de conexión PostgreSQL que proporciona el proveedor y sus parámetros TLS/pooling. `DATABASE_URL` solo se usa en el backend. El cliente web usa `VITE_API_URL=/api` y el proxy de Vite reenvía esas rutas a `http://localhost:3000` durante el desarrollo.

Configura también `frontend/.env` (copia `frontend/.env.example`) con:

```dotenv
VITE_API_URL=/api
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE
```

La clave anon/publishable es pública y puede estar en el bundle del navegador; nunca uses `service_role` en el frontend. `SUPABASE_ANON_KEY` en el backend es la misma clave pública para llamar a Auth. No compartas `DATABASE_URL` ni contraseñas.

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

## Aplicación web progresiva

La compilación de producción incluye un Web App Manifest, iconos del taller y un service worker que conserva el shell público para abrirlo sin conexión. El único endpoint de API que se puede guardar es el catálogo público `GET /api/servicios`; el catálogo disponible offline debe haberse cargado anteriormente en ese dispositivo. Login, citas y rutas/endpoints de administración requieren red y no se almacenan en caché ni se sincronizan después.

Para probar la instalación en desarrollo local, construye y sirve la versión de producción:

```bash
npm run build
npm --prefix frontend run preview -- --host 127.0.0.1
```

Abre la URL local que imprime Vite Preview. `localhost` sirve como contexto seguro para la prueba; en producción se requiere HTTPS. El menú del navegador permite instalar la app cuando el navegador admite instalación de PWAs. La experiencia offline sirve contenido público estático y el catálogo previamente consultado, no permite solicitar ni gestionar citas.

## SEO y páginas de error

La portada y el catálogo establecen título, descripción y metadatos Open Graph en el cliente. Login, formulario de citas, panel administrativo y 404 se marcan como `noindex, nofollow`; `frontend/public/robots.txt` restringe el rastreo de esas rutas y de `/api/`. No se publica sitemap todavía porque falta definir el dominio público y las URL canónicas. Como la web es una SPA sin renderizado del servidor, los metadatos de rutas secundarias se aplican después de cargar JavaScript; una publicación que requiera vistas previas sociales deterministas puede necesitar prerenderizado o SSR.

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

## Autenticación y permisos

La página `/login` inicia sesión con correo y contraseña de Supabase Auth; el sistema no ofrece registro de empleados. Supabase guarda la sesión en `sessionStorage` (se elimina al cerrar la pestaña). Cada ruta privada envía el access token al API. Express valida identidad en Supabase y busca el rol en `StaffProfile`; nunca acepta roles desde el navegador ni desde metadatos editables.

| Rol             | Permisos actuales                               |
| --------------- | ----------------------------------------------- |
| `ADMINISTRADOR` | Acceso al panel y gestión de citas pendientes   |
| `RECEPCIONISTA` | Consulta, confirmación y cancelación de citas   |
| `MECANICO`      | Sin acceso al panel de recepción en este avance |

Solo `ADMINISTRADOR` y `RECEPCIONISTA` acceden a `GET /api/admin/citas` y `PATCH /api/admin/citas/:id/estado`. El cambio de estado se ejecuta en PostgreSQL de forma condicional: solo una cita `PENDIENTE` puede pasar a `CONFIRMADA` o `CANCELADA`; los estados terminales no se reabren desde este endpoint. El backend devuelve `401` si falta o no es válido el token y `403` si falta el perfil o el rol no autoriza la acción.

### Alta administrativa de empleados

1. En Supabase Dashboard, crea al empleado desde **Authentication → Users → Add user** y establece su contraseña mediante el flujo autorizado.
2. Copia el UUID asignado al usuario.
3. Un administrador autorizado asigna el rol con SQL Editor. No se concede acceso solo por crear una cuenta:

```sql
INSERT INTO public."StaffProfile" ("userId", role, "displayName")
VALUES ('UUID_DEL_USUARIO_AUTH', 'RECEPCIONISTA', 'Nombre del empleado');
```

Valores válidos: `ADMINISTRADOR`, `RECEPCIONISTA`, `MECANICO`. La tabla tiene RLS activado y acceso directo revocado para los roles `anon` y `authenticated`; el API consulta mediante su conexión de servidor.

## Verificaciones

Desde la raíz:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

Las pruebas HTTP usan repositorios y servicios inyectados para verificar validación, tokens, autenticación, permisos y transiciones sin escribir en una base compartida. La conexión real se comprueba con `npm --prefix backend run db:check`; no se realizan escrituras destructivas en producción.

## Alcance y limitaciones actuales

- El catálogo y el formulario usan la API y guardan solicitudes cuando hay una base accesible y migrada.
- La disponibilidad de una hora no se confirma automáticamente; el taller debe confirmar la solicitud.
- La disponibilidad de horarios sigue dependiendo de la confirmación del taller.
- El panel actual se limita a consultar, confirmar y cancelar solicitudes; usuarios y otros módulos quedan pendientes.
- No se incluyen facturación, inventario, órdenes de trabajo, notificaciones, reportes ni pagos.

## Código de verificación académica

`LEARN-CAP-AAF98C6D`

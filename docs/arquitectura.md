# Arquitectura de Claros Auto

La aplicación separa la interfaz React del backend Express y la persistencia PostgreSQL. El navegador solo comunica con `/api`; las credenciales de PostgreSQL y el cliente Prisma permanecen en el backend.

## Organización técnica

- `frontend/src/components`: formulario de cita, tarjetas de servicio y componentes compartidos.
- `frontend/src/pages`: vistas de inicio, catálogo y citas.
- `frontend/src/services/api.ts`: cliente HTTP que transforma la entrada del formulario al contrato REST.
- `backend/src/config/database.ts`: `pg.Pool`, adaptador Prisma y cliente singleton.
- `backend/src/config/api.ts`: orígenes CORS permitidos.
- `backend/src/modules/servicios`: consulta de servicios activos.
- `backend/src/modules/citas`: validación Zod, rutas, controladores, lógica de token y persistencia.
- `backend/src/middleware/errorHandler.ts`: formato común de errores sin detalles internos.
- `backend/prisma/schema.prisma`: esquema relacional fuente.
- `backend/prisma/migrations`: migraciones versionadas.
- `backend/prisma/seed.ts`: catálogo inicial repetible de servicios.

Express limita el cuerpo JSON a 16 KB. El registro de citas acepta hasta 10 solicitudes por ventana de 15 minutos. CORS permite solo los orígenes declarados en `CORS_ORIGIN` (por defecto, el servidor Vite local). Las rutas de API están organizadas para inyectar dependencias en pruebas HTTP.

## Modelo relacional

```mermaid
erDiagram
  Customer ||--o{ Vehicle : posee
  Customer ||--o{ Appointment : solicita
  Vehicle ||--o{ Appointment : corresponde
  Service ||--o{ Appointment : seleccionada

  Customer {
    uuid id PK
    varchar name
    varchar phone
    varchar email "opcional"
    timestamptz createdAt
  }
  Vehicle {
    uuid id PK
    uuid customerId FK
    varchar make
    varchar model
    smallint year
    varchar plate "opcional"
    timestamptz createdAt
  }
  Service {
    string id PK
    varchar slug UK
    varchar name
    varchar description
    boolean isActive
    timestamptz createdAt
  }
  Appointment {
    uuid id PK
    uuid customerId FK
    uuid vehicleId FK
    string serviceId FK
    timestamptz requestedAt
    varchar notes "opcional"
    AppointmentStatus status
    char lookupTokenHash
    timestamptz createdAt
  }
```

`AppointmentStatus` tiene los valores `PENDIENTE`, `CONFIRMADA`, `CANCELADA` y `COMPLETADA`; las citas nuevas siempre comienzan como `PENDIENTE`. Las claves foráneas restringen la eliminación de registros referenciados. Hay índices para teléfonos, relaciones, estado y fecha. El token de consulta sin procesar nunca se guarda; solo su hash SHA-256.

El archivo [modelo-datos.json](modelo-datos.json) representa los mismos modelos, campos, tipos, valores enum y relaciones que `schema.prisma`.

## Endpoints

| Método y ruta                       | Función                                                  | Respuesta principal                                |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `GET /api/health`                   | Verifica que la API está activa. No consulta PostgreSQL. | `200 { status: "ok", service: "claros-auto-api" }` |
| `GET /api/servicios`                | Devuelve servicios activos, sin datos privados.          | `200 { data: [...] }`                              |
| `POST /api/citas`                   | Valida y guarda una solicitud con estado `PENDIENTE`.    | `201 { data: { id, status, lookupToken, ... } }`   |
| `GET /api/citas/:id`                | Devuelve estado, fechas y servicio de una cita.          | `200 { data: ... }`                                |
| `GET /api/auth/me`                  | Verifica sesión e identidad de empleado.                 | `200 { data: ... }`                                |
| `GET /api/admin/citas`              | Lista citas para recepción y administración.             | `200 { data: [...] }`                              |
| `PATCH /api/admin/citas/:id/estado` | Confirma o cancela una cita pendiente.                   | `200 { data: ... }`                                |

`GET /api/citas/:id` requiere `Authorization: Bearer <lookupToken>`. Un token faltante o mal formado responde `401`; un token no coincidente devuelve `404` para no confirmar si existe la cita. Ningún endpoint ofrece un listado público de citas. Las respuestas de consulta usan `Cache-Control: no-store`.

## Migraciones y configuración

Define `DATABASE_URL` en `backend/.env` con el URL PostgreSQL proporcionado por la instalación local o el proveedor administrado. No coloques esa variable en el frontend ni en el repositorio. `CORS_ORIGIN` admite una lista separada por comas, y `PORT` controla el puerto del backend.

Para aplicar migraciones versionadas y cargar el catálogo:

```bash
npm --prefix backend run db:migrate:deploy
npm --prefix backend run db:seed
```

Para cambios de esquema durante desarrollo, ejecuta `npm --prefix backend run db:migrate:dev -- --name descripcion`. Antes de producción, revisa el SQL de cada migración y verifica el estado con `db:migrate:status`.

## Autenticación y arquitectura de seguridad

Supabase Auth administra credenciales, login y sesiones. React usa `@supabase/supabase-js` con PKCE y `sessionStorage`; no hay registro público de empleados ni contraseñas en código. La clave anon/publishable identifica el proyecto, pero no concede permisos por sí misma.

El cliente envía el access token en `Authorization: Bearer ...`. Express valida el token con Supabase y consulta `StaffProfile` con el UUID verificado. La autorización de roles ocurre en el backend. Si Supabase no está configurado o no responde, la API falla de forma cerrada (`503`); un token ausente/inválido devuelve `401`; un empleado sin perfil o sin permisos devuelve `403`. No se aceptan roles en solicitudes ni metadatos editables.

`StaffProfile` enlaza el UUID de `auth.users` con `ADMINISTRADOR`, `RECEPCIONISTA` o `MECANICO`. La migración activa RLS y revoca privilegios SQL de `anon` y `authenticated`; el backend conserva su conexión PostgreSQL. Las cuentas se crean mediante el Dashboard y su rol se asigna administrativamente. No existe endpoint para asignar roles.

| Acción                                | ADMINISTRADOR | RECEPCIONISTA | MECANICO |
| ------------------------------------- | ------------- | ------------- | -------- |
| Consultar citas privadas              | Sí            | Sí            | No       |
| Confirmar/cancelar citas pendientes   | Sí            | Sí            | No       |
| Reabrir una cita confirmada/cancelada | No            | No            | No       |

El estado se actualiza con una operación condicional en PostgreSQL que solo cambia filas `PENDIENTE`. Las respuestas administrativas usan `Cache-Control: no-store` porque contienen datos personales.

Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `frontend/.env`, y `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `backend/.env`. La clave `service_role` no se utiliza. Mantén todos los `.env` fuera de Git. La decisión de autenticación y almacenamiento de roles está registrada en [ADR-002](adr/ADR-002-autenticacion.md).

## Verificación y limitaciones

`npm test` ejercita rutas públicas, autenticación, permisos y cambios administrativos con servicios inyectados, sin escribir en una base compartida. `npm --prefix backend run db:validate` valida el esquema y `db:check` verifica conexión, tablas y migraciones registradas. La suite contra PostgreSQL debe apuntar a una base de pruebas aislada; no se ejecutan escrituras de prueba en producción.

No se implementan disponibilidad/calendario ni confirmación automática; el taller confirma cada solicitud desde el panel. La consulta pública sigue requiriendo el token de cita que se muestra una vez al registrarla. Administración de empleados, inventario, facturación y órdenes de trabajo quedan pendientes.

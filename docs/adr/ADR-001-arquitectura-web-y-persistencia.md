# ADR-001: Arquitectura web y persistencia administrada

- **Estado:** Aceptada
- **Fecha:** 2026-11-16

## Contexto

Claros Auto necesita ofrecer un catálogo público y registrar solicitudes de cita, con una base relacional accesible desde el backend. El frontend no debe contener credenciales de base de datos ni ejecutar operaciones privilegiadas directamente.

## Alternativas consideradas

1. Aplicación monolítica con interfaz y persistencia en el mismo proceso.
2. Frontend React separado y API Express propia con PostgreSQL administrado.
3. Acceso directo desde el navegador a PostgreSQL o a tablas de negocio mediante una clave privilegiada.

## Decisión

Se adopta una SPA React + TypeScript servida como archivos estáticos, una API Node.js + Express y Prisma como capa de persistencia sobre Supabase PostgreSQL. El navegador solo llama a la API para operaciones de negocio. Las credenciales PostgreSQL permanecen en el entorno del backend. Supabase Auth administra las sesiones; los roles y la autorización de negocio se validan en Express, según ADR-002.

## Consecuencias

### Positivas

- La interfaz puede desplegarse en un hosting estático y la API en un servicio Node.js.
- Las validaciones y reglas de acceso se aplican en el servidor.
- PostgreSQL aporta relaciones, restricciones y migraciones versionadas.
- El proveedor administra la disponibilidad de base de datos y autenticación.

### Costes y limitaciones

- Frontend y backend requieren configuración y despliegue separados o un proxy equivalente.
- Producción debe establecer `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN` y `PORT` según el proveedor.
- Las migraciones de esquema deben ejecutarse como una tarea controlada antes de habilitar la nueva versión.
- La publicación real, dominios, TLS y reglas CORS dependen del hosting elegido.

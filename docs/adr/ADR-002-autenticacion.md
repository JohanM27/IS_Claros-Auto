# ADR-002: Autenticación de empleados y control de acceso

- **Estado:** Aceptada
- **Fecha:** 2026-11-18

## Contexto

Claros Auto necesita cuentas privadas para el personal y autorización para ver datos de clientes y administrar citas. La interfaz React es pública y no puede ser la autoridad de permisos. Las citas y perfiles se guardan en Supabase PostgreSQL y el API Express accede a ellos mediante Prisma.

## Alternativas consideradas

1. Implementar almacenamiento propio de contraseñas, reset de contraseña y emisión de tokens en Express.
2. Confiar en guards del frontend o en metadatos de roles incluidos en el JWT.
3. Delegar identidad y manejo de contraseñas en Supabase Auth y autorizar en Express con un perfil de rol almacenado en PostgreSQL.

## Decisión

Se adopta Supabase Auth para alta administrativa de cuentas, login correo/contraseña y gestión de sesiones. El frontend usa el cliente oficial con PKCE y `sessionStorage`, evitando persistir el token en `localStorage`. El API recibe el bearer token, lo valida con Supabase y obtiene el UUID de identidad. Después lee `StaffProfile` desde PostgreSQL para determinar el rol; nunca confía en datos de rol suministrados por el navegador o en metadatos editables.

La autorización se aplica en middleware Express reutilizable. `ADMINISTRADOR` y `RECEPCIONISTA` pueden consultar y modificar citas pendientes; `MECANICO` no tiene acceso al panel de recepción por ahora. Los cambios de estado son condicionales en la base para impedir transiciones desde estados no pendientes. `StaffProfile` tiene RLS activado y privilegios directos revocados a `anon` y `authenticated`; el acceso de servidor se mantiene en Express.

## Consecuencias

### Positivas

- No se almacenan ni procesan contraseñas en el backend propio.
- Las credenciales del proveedor y del servidor permanecen fuera del bundle del navegador.
- El backend valida cada token y consulta un rol confiable antes de devolver datos privados.
- No hay registro público ni endpoint de autoasignación de rol.
- Las decisiones de rol pueden ampliarse en `StaffProfile` y middleware sin basarse en la interfaz.

### Costes y limitaciones

- Auth requiere configurar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- La verificación de identidad depende de la disponibilidad de Supabase Auth; si el servicio no responde, endpoints privados fallan de forma cerrada.
- El usuario debe crearse en el Dashboard y un administrador autorizado debe asociarle un registro `StaffProfile`.
- `sessionStorage` termina al cerrar la pestaña; el empleado vuelve a autenticarse en una sesión nueva.
- La configuración de Auth, RLS y HTTPS de producción sigue siendo responsabilidad de despliegue.

# Inventario: categorías de repuestos

## Alcance actual

La pantalla `/admin/inventario/categorias` permite consultar, buscar, filtrar, crear, editar, desactivar y reactivar categorías. La tabla usa paginación del backend de 10 filas por página y muestra el número de repuestos relacionados mediante el conteo de relación de Prisma. No descarga los productos para calcular ese valor.

No hay categorías de ejemplo insertadas en Supabase. Una base sin categorías muestra un estado vacío. El formulario crea las categorías que el administrador registre.

## Endpoints

Todas las rutas se publican bajo `/api/admin/inventario/categorias` y requieren `Authorization: Bearer <access-token>`.

| Método  | Ruta          | Acceso                       | Propósito                                                                           |
| ------- | ------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `GET`   | `/`           | Administrador, recepcionista | Buscar, filtrar por estado y paginar; orden alfabético.                             |
| `GET`   | `/:id`        | Administrador, recepcionista | Consultar una categoría y su conteo de repuestos. Recepción solo puede ver activas. |
| `POST`  | `/`           | Administrador                | Crear una categoría activa.                                                         |
| `PATCH` | `/:id`        | Administrador                | Cambiar el nombre o la descripción.                                                 |
| `PATCH` | `/:id/estado` | Administrador                | Desactivar o reactivar con `{ "activo": boolean }`.                                 |

El listado acepta `q`, `estado` (`TODAS`, `ACTIVAS` o `INACTIVAS`), `page` y `pageSize`. El tamaño predeterminado es 10 y el máximo permitido es 50. Recepción siempre recibe categorías activas, aunque intente solicitar otro estado.

## Validación y reglas

- El nombre es obligatorio, tiene un máximo de 150 caracteres y se guarda sin espacios iniciales/finales ni repeticiones internas.
- La clave única `nombreNormalizado` usa normalización Unicode, espacios compactados y minúsculas para impedir duplicados por mayúsculas/minúsculas o solicitudes concurrentes. PostgreSQL aplica la restricción única.
- La descripción es opcional y admite hasta 1,000 caracteres.
- No se permite la eliminación física. La desactivación conserva datos y relaciones.
- No se desactiva una categoría mientras tenga repuestos activos.
- La transición de estado usa transacción serializable y bloquea la fila de categoría antes de comprobar los repuestos activos.
- Las futuras operaciones de registro de repuestos deben llamar `validarCategoriaActivaParaRepuesto` dentro de la misma transacción que crea el repuesto. El bloqueo compartido impide asignar un producto nuevo a una categoría que se desactiva simultáneamente.
- Reacción y edición mantienen el identificador y las relaciones existentes; Prisma actualiza `fechaActualizacion`.

## Roles

| Operación                             | Administrador | Recepcionista | Mecánico |
| ------------------------------------- | ------------- | ------------- | -------- |
| Consultar categorías activas          | Sí            | Sí            | No       |
| Consultar categorías inactivas        | Sí            | No            | No       |
| Crear, editar, desactivar o reactivar | Sí            | No            | No       |

La API valida los roles; ocultar acciones en React no sustituye la autorización del backend. Las tablas privadas conservan RLS y privilegios revocados para `anon` y `authenticated`; la API usa la conexión PostgreSQL del servidor.

## Esquema y migraciones

Esta funcionalidad reutiliza `CategoriaRepuesto` y la relación `CategoriaRepuesto.repuestos` existente. No requiere cambios al esquema Prisma ni una migración nueva: `nombreNormalizado` ya es único, la fecha de modificación usa `@updatedAt` y existe un índice por estado/nombre. La migración de inventario existente es `20261124120000_inventario_repuestos`; la protección RLS está en `20261124130000_proteger_inventario`.

No se ejecutaron migraciones ni escrituras de prueba en Supabase durante este avance.

## Verificaciones

Desde la raíz del proyecto:

```powershell
npm test -- backend/src/modules/inventario
npm run lint
npm --prefix backend run db:validate
npm run build
```

Las pruebas del módulo usan dependencias controladas y no escriben en la base de datos real. Una prueba de persistencia extremo a extremo requiere una base aislada de pruebas; no se debe apuntar la suite de escritura a la base de producción.

# Inventario de repuestos

## Alcance implementado

El panel `/admin/inventario` muestra el resumen del inventario. Desde allí se administran el catálogo `/admin/inventario/repuestos` y las categorías `/admin/inventario/categorias`. El catálogo de repuestos permite registrar, consultar, buscar, filtrar, paginar, editar, desactivar y reactivar productos mediante la API Express y Prisma conectada a PostgreSQL. No usa datos ficticios ni `localStorage`.

## Registro e identificación

- Nombre y categoría activa son obligatorios. Descripción, marca, número de parte y código de barras son opcionales.
- El backend obtiene el SKU con `nextval` de `RepuestoSku_seq`, que es seguro ante solicitudes simultáneas. El SKU tiene formato `REP-00001`, es único, no se recibe ni se modifica desde el navegador, y la secuencia no se reinicia al desactivar productos.
- El alta usa una clave de idempotencia UUID persistida con índice único. Si una solicitud se reintenta con la misma clave, la API devuelve el producto que se creó en el primer intento, incluso si llegaron dos solicitudes concurrentes.
- El código de barras es texto opcional, conserva ceros iniciales, normaliza vacío a `null` y tiene índice único para valores no nulos. Se puede teclear o capturar con un lector que actúe como teclado. El SKU permanece como identificador alternativo.
- El número de parte se almacena como texto, no necesita ser único y puede buscarse.
- Unidades compatibles con el esquema: unidad, litro, galón, mililitro, kilogramo, gramo, metro, juego, par, caja y botella. Las cantidades admiten hasta tres decimales. No se realizan conversiones; cambiar la unidad se rechaza si el producto tiene existencias.
- Los precios se validan en el servidor y se guardan como `Decimal(12,2)`; el stock mínimo y actual usan `Decimal(12,3)`. El stock se inicia en cero y no se acepta en el formulario ni en el endpoint de edición. No hay ajuste manual ni movimientos en este avance.
- Para administración, la interfaz calcula ganancia bruta y margen estimados usando importes en centavos. Si el precio de venta queda por debajo del costo muestra una advertencia, sin bloquearlo. En precio de venta cero el margen no aplica. Son estimaciones brutas, no utilidad neta.

## Consulta y búsqueda

El listado presenta SKU, nombre, categoría, marca, número de parte, precio de venta, existencias, unidad, estado y, solo para administración, precio de compra. Permite buscar por nombre, SKU, código de barras, número de parte o marca; el código exacto se prioriza en la primera página. Tiene filtro de categoría, marca y estado para administración; recepción siempre consulta productos activos. La búsqueda espera 250 ms tras la última tecla y la paginación del servidor usa 10 filas por página (máximo 50).

La vista de detalle incluye datos de identificación, inventario y fechas. Costos, ganancia y margen no se seleccionan ni serializan en las respuestas para recepción.

## Edición y estado

El SKU, ID, existencias y fecha de creación no se pueden editar. Cambios de categoría requieren que la categoría esté activa. Costos y precios se validan como decimales no negativos; texto vacío opcional se guarda como `null`. Prisma actualiza la fecha de modificación. No se reescriben importes de órdenes ni registros históricos.

La baja es lógica; no se borra el producto. El backend rechaza desactivar si el stock es mayor que cero. Reactivar exige categoría activa. Se pide confirmación en la interfaz y los productos conservan SKU y datos al estar inactivos.

## Endpoints

Las rutas están bajo `/api/admin/inventario` y requieren un token Bearer de Supabase.

| Método | Ruta                    | Acceso                       | Uso                                              |
| ------ | ----------------------- | ---------------------------- | ------------------------------------------------ |
| GET    | `/repuestos`            | Administrador, recepcionista | Búsqueda, filtros y paginación                   |
| GET    | `/repuestos/:id`        | Administrador, recepcionista | Detalle; recepción solo encuentra activos        |
| POST   | `/repuestos`            | Administrador                | Crear; genera SKU y stock inicial cero           |
| PATCH  | `/repuestos/:id`        | Administrador                | Editar campos permitidos                         |
| PATCH  | `/repuestos/:id/estado` | Administrador                | Desactivar/reactivar con `{ "activo": boolean }` |

La lista acepta `q`, `categoriaId`, `marca`, `estado` (`TODOS`, `ACTIVOS`, `INACTIVOS`), `page` y `pageSize`. En respuestas a recepción se omiten costos de compra.

## Roles

| Operación                                                 | Administrador | Recepcionista | Mecánico |
| --------------------------------------------------------- | ------------- | ------------- | -------- |
| Consultar productos activos, buscar y ver precio de venta | Sí            | Sí            | No       |
| Ver costo de compra, margen o ganancia estimada           | Sí            | No            | No       |
| Crear o editar productos y establecer precios             | Sí            | No            | No       |
| Desactivar o reactivar                                    | Sí            | No            | No       |

Express vuelve a validar autenticación y rol en cada operación; la interfaz solo adapta la presentación. No se crean cuentas de mecánicos.

## Esquema y migraciones

El avance reutiliza `Repuesto`, `CategoriaRepuesto`, `UnidadMedidaRepuesto`, la secuencia y restricciones creadas por `20261124120000_inventario_repuestos`, además de la protección RLS de `20261124130000_proteger_inventario`. Añade una columna nullable de clave idempotente con índice único mediante la migración aditiva `20261126120000_idempotencia_repuestos`; conserva todas las filas existentes y no modifica migraciones anteriores. La migración está preparada, pero no se ejecutó contra Supabase. Tampoco se escribió/consultó la base productiva desde las pruebas. La persistencia real debe confirmarse en el entorno configurado por el usuario.

## Verificaciones

Desde la raíz:

```powershell
npm test -- backend/src/modules/inventario frontend/src/pages/InventoryPartsPage.test.tsx
npm run lint
npm --prefix backend run db:validate
npm run build
```

La suite usa dependencias controladas y no ejecuta escrituras en Supabase. Una prueba de persistencia y concurrencia real requiere una base de pruebas separada y aislada, no producción.

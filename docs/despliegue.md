# Preparación de despliegue

Esta guía describe una publicación futura. No hay dominio ni proveedor de hosting definidos; no se considera que el sistema esté publicado.

## Variables por componente

| Componente                 | Variable                 | Uso                                                                                                             |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Frontend, durante el build | `VITE_API_URL`           | URL relativa `/api` si el hosting enruta la API en el mismo dominio; URL HTTPS de la API si está en otro origen |
| Frontend, durante el build | `VITE_SUPABASE_URL`      | URL pública del proyecto Supabase                                                                               |
| Frontend, durante el build | `VITE_SUPABASE_ANON_KEY` | Clave anon/publishable; nunca `service_role`                                                                    |
| Backend                    | `DATABASE_URL`           | Conexión PostgreSQL privada del servidor                                                                        |
| Backend                    | `SUPABASE_URL`           | Proyecto usado para verificar tokens Auth                                                                       |
| Backend                    | `SUPABASE_ANON_KEY`      | Clave pública usada para consultar Supabase Auth                                                                |
| Backend                    | `CORS_ORIGIN`            | Origen HTTPS exacto del frontend; varios orígenes separados por coma                                            |
| Backend                    | `PORT`                   | Puerto HTTP asignado por la plataforma de hosting                                                               |
| Backend                    | `NODE_ENV`               | `production` en producción                                                                                      |

Configura secretos y variables en el panel del proveedor. No subas `.env` ni secretos a GitHub. `DATABASE_URL` solo se configura en backend. No uses la clave `service_role` en el navegador.

## Frontend

1. Usa Node.js 22 y npm 10 o posterior.
2. Instala dependencias con `npm ci`, `npm ci --prefix frontend` y `npm ci --prefix backend`.
3. Configura las tres variables Vite en el entorno de build.
4. Ejecuta `npm --prefix frontend run build`; publica `frontend/dist` en el hosting estático.
5. Configura fallback de rutas SPA hacia `/index.html` para rutas públicas de React Router. No configures una regla de caché que guarde páginas privadas como respuestas autenticadas.
6. Activa HTTPS/TLS en el proveedor y configura redirección HTTP a HTTPS.

## Backend y Supabase

1. Configura las variables de backend en el entorno seguro del servicio Node.js.
2. Construye con `npm --prefix backend run build` y arranca con `npm --prefix backend start`.
3. Antes del despliegue, valida la conexión con `npm --prefix backend run db:check` desde un entorno con acceso de red a Supabase.
4. Revisa las migraciones y ejecútalas como tarea de despliegue controlada con `npm --prefix backend run db:migrate:deploy`. Usa una cadena compatible con el motor de migraciones de Prisma; para problemas con pooling, usa la conexión directa o de sesión recomendada por Supabase para migraciones. No apliques cambios de esquema desde cada instancia de la API.
5. Carga datos de catálogo solo si corresponde mediante `npm --prefix backend run db:seed`.
6. Establece `CORS_ORIGIN` al origen HTTPS definitivo del frontend. No uses `*` para producción.
7. Configura el health check del proveedor como `GET /api/health`.

El endpoint `/api/health` confirma que Express responde, pero no comprueba PostgreSQL. `npm --prefix backend run db:check` verifica conexión, tablas requeridas, RLS de `StaffProfile` y migraciones esperadas; requiere variables válidas y acceso al proyecto.

## HTTPS

El proveedor de hosting debe terminar TLS y mantener HTTPS para frontend y API. Configura URLs de Supabase/Auth para aceptar el origen de producción y sus redirect URLs. No se incluye ningún dominio ficticio en la configuración; añade los dominios reales cuando el proveedor los asigne.

## SonarQube Cloud (SonarCloud)

El workflow `.github/workflows/sonarcloud.yml` está preparado, pero permanece sin ejecutar hasta configurar en GitHub:

- Secret `SONAR_TOKEN` con token de análisis del proyecto.
- Variable `SONAR_ORGANIZATION` con la clave real de la organización.
- Variable `SONAR_PROJECT_KEY` con la clave real del proyecto importado.

Importa primero el repositorio en SonarQube Cloud. Al completar los tres valores, el workflow ejecuta el análisis para Pull Requests y pushes a `main`. No se afirma que SonarCloud esté configurado o que el análisis haya pasado antes de una ejecución real.

## Lista de comprobación antes de publicar

- [ ] Revisar el Pull Request y preservar los cinco commits individuales.
- [ ] Definir dominios reales de frontend y backend.
- [ ] Configurar variables y secretos en los proveedores, sin publicarlos en Git.
- [ ] Confirmar `CORS_ORIGIN`, URL de Auth y redirect URLs para producción.
- [ ] Habilitar HTTPS/TLS y redirección a HTTPS.
- [ ] Ejecutar migraciones revisadas y comprobar `db:check`.
- [ ] Ejecutar CI en GitHub y confirmar verde para lint, pruebas y build.
- [ ] Configurar SonarQube Cloud y revisar el resultado del análisis.
- [ ] Confirmar `/api/health`, catálogo, login con empleado autorizado y registro de cita.
- [ ] Verificar que páginas administrativas y citas no se almacenan en caché pública.
- [ ] Configurar logging, alertas y respaldo/retención del proyecto Supabase.
- [ ] Ejecutar auditoría actualizada de dependencias con acceso a npm.

## Pendientes externos conocidos

- Dominio y proveedor de hosting todavía no definidos.
- Workflow de GitHub Actions está versionado, pero no se verificó una ejecución alojada en GitHub.
- SonarQube Cloud requiere importar el proyecto y configurar token/variables de GitHub.
- La auditoría de `frontend` y `backend` no pudo consultar el registro de npm desde el entorno de desarrollo; debe repetirse con conexión habilitada.
- La instalación de PWA en un navegador real aún requiere verificación desde el equipo del usuario.

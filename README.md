# Claros Auto

Claros Auto es una aplicación web para apoyar la administración de un taller automotriz. El proyecto busca reunir en un solo sistema la información operativa que suele mantenerse en registros separados, reducir tareas manuales y facilitar el seguimiento del servicio a los vehículos.

## Objetivo

Establecer una base web mantenible para una página pública y un panel administrativo privado. Este primer avance configura el frontend React y la API Express, agrega un endpoint de salud y prepara verificaciones automáticas. No implementa todavía procesos de negocio ni conexión a PostgreSQL.

## Tecnologías

- **Frontend:** React, TypeScript, Vite, Tailwind CSS y React Router.
- **Backend:** Node.js, Express y TypeScript.
- **Calidad:** ESLint y Prettier.
- **Pruebas:** Vitest y Supertest.
- **Persistencia futura:** PostgreSQL.
- **Control de versiones:** Git y GitHub.

## Estructura

```text
.
├── backend/
│   ├── src/
│   │   ├── middleware/       # Manejo de errores HTTP
│   │   ├── routes/           # Rutas de la API
│   │   ├── app.ts             # Configuración de Express
│   │   └── server.ts          # Inicio del servidor
│   ├── .env.example
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Componentes, tarjetas y formularios reutilizables
│   │   ├── data/             # Catálogo de servicios de demostración
│   │   ├── layouts/          # Estructuras de página
│   │   ├── pages/            # Vistas de la aplicación
│   │   ├── types/            # Tipos de dominio del frontend
│   │   └── utils/            # Validación de solicitudes
│   └── vite.config.ts
├── docs/
│   └── arquitectura.md
├── eslint.config.js
├── prettier.config.js
└── vitest.config.ts
```

## Requisitos

- Node.js 22 o posterior.
- npm 10 o posterior.
- Git.

## Instalación

Desde la raíz del repositorio, instala las dependencias de herramientas, frontend y backend:

```bash
npm ci
npm --prefix frontend ci
npm --prefix backend ci
```

Para configurar el puerto de la API, copia la plantilla y edita el archivo local si hace falta:

```bash
cp backend/.env.example backend/.env
```

En PowerShell, puedes usar `Copy-Item backend/.env.example backend/.env`. Los archivos `.env` locales están excluidos de Git.

## Ejecución local

Abre dos terminales en la raíz del repositorio. En la primera, inicia el frontend:

```bash
npm --prefix frontend run dev
```

Vite mostrará la dirección local, normalmente `http://localhost:5173`.

En la segunda, inicia la API:

```bash
npm --prefix backend run dev
```

La API escucha en el puerto `3000` por defecto. Puedes comprobar su estado en `http://localhost:3000/api/health`. La respuesta es JSON con estado `ok`. El puerto se puede cambiar con la variable `PORT` en `backend/.env`.

## Verificaciones

Ejecuta desde la raíz:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

La suite cubre las rutas públicas, navegación adaptable, catálogo, validación del formulario y el endpoint `GET /api/health`.

## Página pública implementada

- `/`: presentación del taller, ventajas, contacto con datos pendientes y enlaces de acción.
- `/servicios`: catálogo adaptable de seis servicios de ejemplo.
- `/citas`: formulario demostrativo con validación y preselección del servicio desde el catálogo.

El formulario no envía ni almacena datos y su mensaje de confirmación aclara que no crea una cita real.

## Módulos previstos

Los siguientes módulos forman parte del alcance futuro y no están implementados en este avance:

- Envío real y administración de citas, incluida la consulta de su estado.
- Gestión de clientes y vehículos.
- Órdenes de trabajo.
- Inventario de repuestos.
- Facturación.
- Inicio de sesión, usuarios, roles y panel administrativo.
- Notificaciones por WhatsApp y pagos en línea.
- Reportes administrativos.
- Persistencia de datos con PostgreSQL.

Consulta [docs/arquitectura.md](docs/arquitectura.md) para la descripción inicial de contexto.

## Código de verificación académica

`LEARN-CAP-AAF98C6D`

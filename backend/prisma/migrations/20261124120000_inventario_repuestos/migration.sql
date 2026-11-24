-- Estructura inicial de categorías y repuestos. No modifica datos existentes.
CREATE TYPE "UnidadMedidaRepuesto" AS ENUM (
  'UNIDAD', 'LITRO', 'GALON', 'MILILITRO', 'METRO',
  'KILOGRAMO', 'GRAMO', 'JUEGO', 'PAR', 'CAJA', 'BOTELLA'
);

-- Una secuencia evita colisiones entre altas concurrentes y no se reinicia al desactivar productos.
CREATE SEQUENCE "RepuestoSku_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE "CategoriaRepuesto" (
  "id" UUID NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "nombreNormalizado" VARCHAR(150) NOT NULL,
  "descripcion" VARCHAR(1000),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "fechaCreacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CategoriaRepuesto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CategoriaRepuesto_nombre_check" CHECK (length(btrim("nombre")) > 0),
  CONSTRAINT "CategoriaRepuesto_nombreNormalizado_check" CHECK (length(btrim("nombreNormalizado")) > 0)
);

CREATE TABLE "Repuesto" (
  "id" UUID NOT NULL,
  "sku" VARCHAR(20) NOT NULL,
  "codigoBarras" VARCHAR(80),
  "nombre" VARCHAR(180) NOT NULL,
  "descripcion" VARCHAR(2000),
  "categoriaId" UUID NOT NULL,
  "marca" VARCHAR(100),
  "numeroParte" VARCHAR(100),
  "unidadMedida" "UnidadMedidaRepuesto" NOT NULL DEFAULT 'UNIDAD',
  "precioCompra" DECIMAL(12,2) NOT NULL,
  "precioVenta" DECIMAL(12,2) NOT NULL,
  "stockActual" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "stockMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "fechaCreacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Repuesto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Repuesto_sku_check" CHECK ("sku" ~ '^REP-[0-9]{5,}$'),
  CONSTRAINT "Repuesto_codigoBarras_check" CHECK ("codigoBarras" IS NULL OR length(btrim("codigoBarras")) > 0),
  CONSTRAINT "Repuesto_nombre_check" CHECK (length(btrim("nombre")) > 0),
  CONSTRAINT "Repuesto_precioCompra_check" CHECK ("precioCompra" >= 0),
  CONSTRAINT "Repuesto_precioVenta_check" CHECK ("precioVenta" >= 0),
  CONSTRAINT "Repuesto_stockActual_check" CHECK ("stockActual" >= 0),
  CONSTRAINT "Repuesto_stockMinimo_check" CHECK ("stockMinimo" >= 0),
  CONSTRAINT "Repuesto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaRepuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CategoriaRepuesto_nombreNormalizado_key" ON "CategoriaRepuesto"("nombreNormalizado");
CREATE INDEX "CategoriaRepuesto_activo_nombre_idx" ON "CategoriaRepuesto"("activo", "nombre");
CREATE UNIQUE INDEX "Repuesto_sku_key" ON "Repuesto"("sku");
CREATE UNIQUE INDEX "Repuesto_codigoBarras_key" ON "Repuesto"("codigoBarras");
CREATE INDEX "Repuesto_categoriaId_activo_idx" ON "Repuesto"("categoriaId", "activo");
CREATE INDEX "Repuesto_activo_nombre_idx" ON "Repuesto"("activo", "nombre");

CREATE TYPE "WorkOrderRecordType" AS ENUM ('DIAGNOSTICO', 'TRABAJO');
CREATE TYPE "WorkOrderRecordAction" AS ENUM ('CREADO', 'ACTUALIZADO', 'RETIRADO');

CREATE TABLE "DiagnosticoOrden" (
  "id" UUID NOT NULL,
  "ordenTrabajoId" UUID NOT NULL,
  "diagnostico" VARCHAR(4000) NOT NULL,
  "causaIdentificada" VARCHAR(2000),
  "recomendaciones" VARCHAR(2000),
  "observaciones" VARCHAR(2000),
  "usuarioRegistroId" UUID NOT NULL,
  "usuarioActualizacionId" UUID NOT NULL,
  "fechaDiagnostico" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaCreacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DiagnosticoOrden_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticoOrdenHistory" (
  "id" UUID NOT NULL,
  "diagnosticoOrdenId" UUID NOT NULL,
  "diagnostico" VARCHAR(4000) NOT NULL,
  "causaIdentificada" VARCHAR(2000),
  "recomendaciones" VARCHAR(2000),
  "observaciones" VARCHAR(2000),
  "usuarioId" UUID NOT NULL,
  "fechaCambio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosticoOrdenHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrabajoRealizado" (
  "id" UUID NOT NULL,
  "ordenTrabajoId" UUID NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "descripcion" VARCHAR(2000),
  "cantidad" DECIMAL(10,2) NOT NULL,
  "precioUnitario" DECIMAL(12,2) NOT NULL,
  "mecanicoResponsable" VARCHAR(150),
  "usuarioRegistroId" UUID NOT NULL,
  "usuarioActualizacionId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "fechaRetiro" TIMESTAMPTZ(3),
  "fechaCreacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "TrabajoRealizado_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrabajoRealizado_cantidad_check" CHECK ("cantidad" > 0),
  CONSTRAINT "TrabajoRealizado_precioUnitario_check" CHECK ("precioUnitario" >= 0)
);

CREATE TABLE "WorkOrderRecordHistory" (
  "id" UUID NOT NULL,
  "ordenTrabajoId" UUID NOT NULL,
  "tipo" "WorkOrderRecordType" NOT NULL,
  "accion" "WorkOrderRecordAction" NOT NULL,
  "registroId" UUID NOT NULL,
  "usuarioId" UUID NOT NULL,
  "snapshot" JSONB NOT NULL,
  "fechaCambio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderRecordHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosticoOrden_ordenTrabajoId_key" ON "DiagnosticoOrden"("ordenTrabajoId");
CREATE INDEX "DiagnosticoOrden_usuarioRegistroId_idx" ON "DiagnosticoOrden"("usuarioRegistroId");
CREATE INDEX "DiagnosticoOrden_usuarioActualizacionId_idx" ON "DiagnosticoOrden"("usuarioActualizacionId");
CREATE INDEX "DiagnosticoOrdenHistory_diagnosticoOrdenId_fechaCambio_idx" ON "DiagnosticoOrdenHistory"("diagnosticoOrdenId", "fechaCambio");
CREATE UNIQUE INDEX "TrabajoRealizado_idempotencyKey_key" ON "TrabajoRealizado"("idempotencyKey");
CREATE INDEX "TrabajoRealizado_ordenTrabajoId_activo_fechaCreacion_idx" ON "TrabajoRealizado"("ordenTrabajoId", "activo", "fechaCreacion");
CREATE INDEX "TrabajoRealizado_usuarioRegistroId_idx" ON "TrabajoRealizado"("usuarioRegistroId");
CREATE INDEX "TrabajoRealizado_usuarioActualizacionId_idx" ON "TrabajoRealizado"("usuarioActualizacionId");
CREATE INDEX "WorkOrderRecordHistory_ordenTrabajoId_fechaCambio_idx" ON "WorkOrderRecordHistory"("ordenTrabajoId", "fechaCambio");
CREATE INDEX "WorkOrderRecordHistory_tipo_registroId_idx" ON "WorkOrderRecordHistory"("tipo", "registroId");

ALTER TABLE "DiagnosticoOrden" ADD CONSTRAINT "DiagnosticoOrden_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosticoOrden" ADD CONSTRAINT "DiagnosticoOrden_usuarioRegistroId_fkey" FOREIGN KEY ("usuarioRegistroId") REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosticoOrden" ADD CONSTRAINT "DiagnosticoOrden_usuarioActualizacionId_fkey" FOREIGN KEY ("usuarioActualizacionId") REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosticoOrdenHistory" ADD CONSTRAINT "DiagnosticoOrdenHistory_diagnosticoOrdenId_fkey" FOREIGN KEY ("diagnosticoOrdenId") REFERENCES "DiagnosticoOrden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosticoOrdenHistory" ADD CONSTRAINT "DiagnosticoOrdenHistory_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrabajoRealizado" ADD CONSTRAINT "TrabajoRealizado_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrabajoRealizado" ADD CONSTRAINT "TrabajoRealizado_usuarioRegistroId_fkey" FOREIGN KEY ("usuarioRegistroId") REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrabajoRealizado" ADD CONSTRAINT "TrabajoRealizado_usuarioActualizacionId_fkey" FOREIGN KEY ("usuarioActualizacionId") REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderRecordHistory" ADD CONSTRAINT "WorkOrderRecordHistory_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderRecordHistory" ADD CONSTRAINT "WorkOrderRecordHistory_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

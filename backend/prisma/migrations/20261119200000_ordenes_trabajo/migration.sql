-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM (
    'ABIERTA',
    'EN_DIAGNOSTICO',
    'EN_PROCESO',
    'FINALIZADA',
    'CANCELADA'
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" UUID NOT NULL,
    "numeroOrden" VARCHAR(30) NOT NULL,
    "clienteId" UUID NOT NULL,
    "vehiculoId" UUID NOT NULL,
    "citaId" UUID,
    "descripcionProblema" VARCHAR(2000) NOT NULL,
    "observaciones" VARCHAR(2000),
    "mecanicoResponsable" VARCHAR(150),
    "estado" "WorkOrderStatus" NOT NULL DEFAULT 'ABIERTA',
    "fechaIngreso" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCreacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_numeroOrden_key" ON "WorkOrder"("numeroOrden");
CREATE UNIQUE INDEX "WorkOrder_citaId_key" ON "WorkOrder"("citaId");
CREATE INDEX "WorkOrder_clienteId_fechaIngreso_idx" ON "WorkOrder"("clienteId", "fechaIngreso");
CREATE INDEX "WorkOrder_vehiculoId_idx" ON "WorkOrder"("vehiculoId");
CREATE INDEX "WorkOrder_estado_fechaIngreso_idx" ON "WorkOrder"("estado", "fechaIngreso");

-- AddForeignKey
ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_vehiculoId_fkey"
  FOREIGN KEY ("vehiculoId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_citaId_fkey"
  FOREIGN KEY ("citaId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

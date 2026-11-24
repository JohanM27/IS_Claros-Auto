-- Add append-only work-order status audit records without changing existing orders.
CREATE TABLE "WorkOrderStatusHistory" (
    "id" UUID NOT NULL,
    "ordenTrabajoId" UUID NOT NULL,
    "estadoAnterior" "WorkOrderStatus" NOT NULL,
    "estadoNuevo" "WorkOrderStatus" NOT NULL,
    "observaciones" VARCHAR(2000),
    "usuarioId" UUID NOT NULL,
    "fechaCambio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderStatusHistory_ordenTrabajoId_fechaCambio_idx"
    ON "WorkOrderStatusHistory"("ordenTrabajoId", "fechaCambio");
CREATE INDEX "WorkOrderStatusHistory_usuarioId_idx"
    ON "WorkOrderStatusHistory"("usuarioId");

ALTER TABLE "WorkOrderStatusHistory"
    ADD CONSTRAINT "WorkOrderStatusHistory_ordenTrabajoId_fkey"
    FOREIGN KEY ("ordenTrabajoId") REFERENCES "WorkOrder"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkOrderStatusHistory"
    ADD CONSTRAINT "WorkOrderStatusHistory_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "StaffProfile"("userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

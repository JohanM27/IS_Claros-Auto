-- Clave única opcional para que los reintentos de alta devuelvan el repuesto original.
-- La columna nullable conserva los registros existentes; el índice protege solicitudes concurrentes.
ALTER TABLE "Repuesto" ADD COLUMN "claveIdempotencia" UUID;

CREATE UNIQUE INDEX "Repuesto_claveIdempotencia_key"
  ON "Repuesto"("claveIdempotencia");

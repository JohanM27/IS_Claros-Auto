-- Las tablas privadas de inventario solo se consultan desde el backend autenticado.
ALTER TABLE "CategoriaRepuesto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Repuesto" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "CategoriaRepuesto", "Repuesto" FROM anon, authenticated;

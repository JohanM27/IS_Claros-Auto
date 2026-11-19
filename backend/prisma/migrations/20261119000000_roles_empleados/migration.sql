-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMINISTRADOR', 'RECEPCIONISTA', 'MECANICO');

-- CreateTable
CREATE TABLE "StaffProfile" (
    "userId" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "displayName" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES auth.users("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Deny direct browser access to employee-role assignments.
ALTER TABLE "StaffProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StaffProfile" FROM anon, authenticated;

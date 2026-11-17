import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../prisma/migrations/20261116000000_modelo_taller/migration.sql', import.meta.url),
  'utf8',
)
const modelData = JSON.parse(
  readFileSync(new URL('../../docs/modelo-datos.json', import.meta.url), 'utf8'),
) as {
  models: {
    name: string
    fields: { name: string; type: string }[]
    relations: { field: string; target: string }[]
  }[]
  enums: Record<string, string[]>
}

describe('modelo Prisma documentado', () => {
  it('mantiene los modelos y campos JSON sincronizados con Prisma', () => {
    const schemaModels = [...schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)]
    expect(modelData.models.map((model) => model.name).sort()).toEqual(
      schemaModels.map(([, name]) => name).sort(),
    )

    for (const [, modelName, block] of schemaModels) {
      const documented = modelData.models.find((model) => model.name === modelName)
      expect(documented).toBeDefined()
      const prismaFields = [...block.matchAll(/^\s+(\w+)\s+([\w]+)(?:\[\])?\??/gm)]
      const documentedFieldNames = [
        ...documented!.fields.map((field) => field.name),
        ...documented!.relations.map((relation) => relation.field),
      ]
      expect(documentedFieldNames.sort()).toEqual(prismaFields.map(([, name]) => name).sort())

      for (const [, fieldName, typeName] of prismaFields) {
        const documentedField = documented!.fields.find((field) => field.name === fieldName)
        if (documentedField) expect(documentedField.type).toBe(typeName)
      }
    }
  })

  it('mantiene el enum y las claves foráneas con restricciones en la migración', () => {
    const enumBlock = schema.match(/enum AppointmentStatus \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const enumValues = enumBlock
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    expect(modelData.enums.AppointmentStatus).toEqual(enumValues)

    expect(migration).toContain('Vehicle_customerId_fkey')
    expect(migration).toContain('Appointment_customerId_fkey')
    expect(migration).toContain('Appointment_vehicleId_fkey')
    expect(migration).toContain('Appointment_serviceId_fkey')
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE')
  })
})

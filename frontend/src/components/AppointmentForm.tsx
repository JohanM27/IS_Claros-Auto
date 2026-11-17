import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, createAppointment, getServices } from '../services/api'
import type {
  AppointmentErrors,
  AppointmentField,
  AppointmentFormValues,
  AppointmentSubmission,
} from '../types/appointment'
import type { Service } from '../types/service'
import { getLocalDateValue, validateAppointment } from '../utils/appointmentValidation'

type FormFieldProps = {
  id: AppointmentField
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}

function FormField({ id, label, required = false, error, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-blue-700">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obligatorio)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

const controlClassName =
  'min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm outline-none transition focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/30'

const initialValues: AppointmentFormValues = {
  fullName: '',
  phone: '',
  email: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  service: '',
  preferredDate: '',
  preferredTime: '',
  notes: '',
}

const backendFieldToForm: Record<string, AppointmentField> = {
  name: 'fullName',
  phone: 'phone',
  email: 'email',
  vehicleMake: 'vehicleMake',
  vehicleModel: 'vehicleModel',
  vehicleYear: 'vehicleYear',
  serviceId: 'service',
  requestedAt: 'preferredDate',
  notes: 'notes',
}

export function AppointmentForm() {
  const [searchParams] = useSearchParams()
  const requestedServiceSlug = searchParams.get('servicio') ?? ''
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState('')
  const [values, setValues] = useState<AppointmentFormValues>(initialValues)
  const [errors, setErrors] = useState<AppointmentErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submission, setSubmission] = useState<AppointmentSubmission | null>(null)
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    let active = true
    getServices()
      .then((items) => {
        if (!active) return
        setServices(items)
        const selected = items.find((service) => service.slug === requestedServiceSlug)
        if (selected) setValues((current) => ({ ...current, service: selected.id }))
      })
      .catch(() => {
        if (active) setServicesError('No se pudo cargar el catálogo. Intenta recargar la página.')
      })
      .finally(() => {
        if (active) setServicesLoading(false)
      })
    return () => {
      active = false
    }
  }, [requestedServiceSlug])

  function updateField(field: AppointmentField, value: string) {
    const updatedValues = { ...values, [field]: value }
    setValues(updatedValues)
    setSubmission(null)
    setRequestError('')

    if (hasSubmitted) setErrors(validateAppointment(updatedValues))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const nextErrors = validateAppointment(values)

    setHasSubmitted(true)
    setErrors(nextErrors)
    setSubmission(null)
    setRequestError('')

    const firstInvalidField = Object.keys(nextErrors)[0] as AppointmentField | undefined
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createAppointment(values)
      setSubmission(result)
      setValues(initialValues)
      setErrors({})
      setHasSubmitted(false)
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped: AppointmentErrors = {}
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const formField = backendFieldToForm[field]
          if (formField && messages[0]) mapped[formField] = messages[0]
        }
        setErrors(mapped)
        setRequestError(error.message)
        const firstField = Object.keys(mapped)[0] as AppointmentField | undefined
        if (firstField) document.getElementById(firstField)?.focus()
      } else {
        setRequestError('No se pudo enviar la solicitud. Intenta de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const errorEntries = Object.entries(errors) as [AppointmentField, string][]

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-950">Tus datos</h2>
        <p className="mt-1 text-sm text-slate-600">Los campos marcados con * son obligatorios.</p>
      </div>

      {errorEntries.length > 0 && (
        <div
          role="alert"
          aria-labelledby="form-errors-title"
          className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
        >
          <p id="form-errors-title" className="font-bold">
            Revisa los campos señalados antes de continuar.
          </p>
          <ul className="mt-2 list-inside list-disc text-sm">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                <a className="underline underline-offset-2" href={`#${field}`}>
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {servicesError && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
          {servicesError}
        </p>
      )}
      {requestError && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
          {requestError}
        </p>
      )}

      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
        <FormField id="fullName" label="Nombre completo" required error={errors.fullName}>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={values.fullName}
            onChange={(event) => updateField('fullName', event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField id="phone" label="Teléfono" required error={errors.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            value={values.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
            className={controlClassName}
          />
          {!errors.phone && (
            <span id="phone-hint" className="sr-only">
              Incluye el código de país si aplica.
            </span>
          )}
        </FormField>
        <FormField id="email" label="Correo electrónico (opcional)" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField id="vehicleMake" label="Marca del vehículo" required error={errors.vehicleMake}>
          <input
            id="vehicleMake"
            name="vehicleMake"
            type="text"
            required
            value={values.vehicleMake}
            onChange={(event) => updateField('vehicleMake', event.target.value)}
            aria-invalid={Boolean(errors.vehicleMake)}
            aria-describedby={errors.vehicleMake ? 'vehicleMake-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField
          id="vehicleModel"
          label="Modelo del vehículo"
          required
          error={errors.vehicleModel}
        >
          <input
            id="vehicleModel"
            name="vehicleModel"
            type="text"
            required
            value={values.vehicleModel}
            onChange={(event) => updateField('vehicleModel', event.target.value)}
            aria-invalid={Boolean(errors.vehicleModel)}
            aria-describedby={errors.vehicleModel ? 'vehicleModel-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField id="vehicleYear" label="Año del vehículo" required error={errors.vehicleYear}>
          <input
            id="vehicleYear"
            name="vehicleYear"
            type="number"
            inputMode="numeric"
            min="1886"
            max={new Date().getFullYear() + 1}
            required
            value={values.vehicleYear}
            onChange={(event) => updateField('vehicleYear', event.target.value)}
            aria-invalid={Boolean(errors.vehicleYear)}
            aria-describedby={errors.vehicleYear ? 'vehicleYear-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField id="service" label="Servicio solicitado" required error={errors.service}>
          <select
            id="service"
            name="service"
            required
            disabled={servicesLoading || Boolean(servicesError)}
            value={values.service}
            onChange={(event) => updateField('service', event.target.value)}
            aria-invalid={Boolean(errors.service)}
            aria-describedby={errors.service ? 'service-error' : undefined}
            className={controlClassName}
          >
            <option value="">
              {servicesLoading ? 'Cargando servicios…' : 'Selecciona un servicio'}
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="preferredDate" label="Fecha preferida" required error={errors.preferredDate}>
          <input
            id="preferredDate"
            name="preferredDate"
            type="date"
            min={getLocalDateValue()}
            required
            value={values.preferredDate}
            onChange={(event) => updateField('preferredDate', event.target.value)}
            aria-invalid={Boolean(errors.preferredDate)}
            aria-describedby={errors.preferredDate ? 'preferredDate-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField id="preferredTime" label="Hora preferida" required error={errors.preferredTime}>
          <input
            id="preferredTime"
            name="preferredTime"
            type="time"
            required
            value={values.preferredTime}
            onChange={(event) => updateField('preferredTime', event.target.value)}
            aria-invalid={Boolean(errors.preferredTime)}
            aria-describedby={errors.preferredTime ? 'preferredTime-error' : undefined}
            className={controlClassName}
          />
        </FormField>
        <FormField id="notes" label="Observaciones">
          <textarea
            id="notes"
            name="notes"
            rows={4}
            value={values.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            className={`${controlClassName} min-h-28 resize-y`}
          />
        </FormField>
      </div>

      <div className="flex flex-col items-start gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-slate-600">
          La solicitud se guardará en el taller y quedará pendiente de confirmación.
        </p>
        <button
          type="submit"
          disabled={
            isSubmitting || servicesLoading || Boolean(servicesError) || services.length === 0
          }
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-blue-700 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? 'Enviando…' : 'Enviar solicitud de cita'}
        </button>
      </div>

      {submission && (
        <div
          role="status"
          className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 leading-7 text-amber-950"
        >
          <p>
            Tu solicitud quedó registrada con estado <strong>PENDIENTE</strong>. El taller debe
            confirmarla.
          </p>
          <p>Guarda este token privado para consultar el estado. No se volverá a mostrar:</p>
          <code className="block break-all rounded bg-white p-2 text-sm">
            {submission.lookupToken}
          </code>
        </div>
      )}
    </form>
  )
}

import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { useMerchant, useCreateMerchant, useUpdateMerchant } from '@/hooks/useMerchants'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface FormData {
  name: string
  cuit: string
  cbu: string
  legalName: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  mcc: string
  splitPercentage: string
  status: string
}

const initialFormData: FormData = {
  name: '',
  cuit: '',
  cbu: '',
  legalName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  mcc: '',
  splitPercentage: '100',
  status: 'PENDING',
}

export default function MerchantFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const { data: merchant, isLoading: isMerchantLoading } = useMerchant(id ?? '', {
    enabled: isEditing,
  })
  const createMutation = useCreateMerchant()
  const updateMutation = useUpdateMerchant()

  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  )
  const [initialized, setInitialized] = useState(!isEditing)

  useEffect(() => {
    if (isEditing && merchant && !initialized) {
      setFormData({
        name: merchant.name ?? '',
        cuit: merchant.cuit ?? '',
        cbu: merchant.cbu ?? '',
        legalName: '',
        email: merchant.email ?? '',
        phone: merchant.phone ?? '',
        address: merchant.address ?? '',
        city: '',
        postalCode: '',
        mcc: merchant.mcc ?? '',
        splitPercentage: '100',
        status: merchant.status ?? 'PENDING',
      })
      setInitialized(true)
    }
  }, [isEditing, merchant, initialized])

  const loading = createMutation.isPending || updateMutation.isPending

  function updateField(key: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.name.trim()) newErrors.name = 'Nombre es requerido'
    if (!formData.cuit.trim()) {
      newErrors.cuit = 'CUIT es requerido'
    } else if (formData.cuit.length !== 11 || !/^\d{11}$/.test(formData.cuit)) {
      newErrors.cuit = 'CUIT debe tener 11 digitos'
    }
    if (!formData.cbu.trim()) {
      newErrors.cbu = 'CBU es requerido'
    } else if (formData.cbu.length !== 22 || !/^\d{22}$/.test(formData.cbu)) {
      newErrors.cbu = 'CBU debe tener 22 digitos'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email es requerido'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email no valido'
    }
    if (!formData.mcc.trim()) newErrors.mcc = 'MCC es requerido'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (isEditing && id) {
      updateMutation.mutate(
        {
          id,
          data: {
            name: formData.name,
            cbu: formData.cbu,
            mcc: formData.mcc,
            email: formData.email,
            phone: formData.phone || undefined,
            address: formData.address || undefined,
          },
        },
        { onSuccess: () => navigate('/merchants') },
      )
    } else {
      createMutation.mutate(
        {
          name: formData.name,
          cuit: formData.cuit,
          cbu: formData.cbu,
          mcc: formData.mcc,
          email: formData.email,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
        },
        { onSuccess: () => navigate('/merchants') },
      )
    }
  }

  if (isEditing && isMerchantLoading) {
    return <LoadingSpinner className="py-12" label="Cargando comercio..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/merchants')}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditing ? 'Editar Comercio' : 'Nuevo Comercio'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Datos del Comercio
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Nombre comercial"
              value={formData.name}
              onChange={(v) => updateField('name', v)}
              error={errors.name}
              required
            />
            <FormField
              label="Razon social"
              value={formData.legalName}
              onChange={(v) => updateField('legalName', v)}
            />
            <FormField
              label="CUIT (11 digitos)"
              value={formData.cuit}
              onChange={(v) => updateField('cuit', v.replace(/\D/g, '').slice(0, 11))}
              error={errors.cuit}
              required
              placeholder="30712345678"
              inputMode="numeric"
            />
            <FormField
              label="CBU (22 digitos)"
              value={formData.cbu}
              onChange={(v) => updateField('cbu', v.replace(/\D/g, '').slice(0, 22))}
              error={errors.cbu}
              required
              placeholder="0070012345678901234567"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Contacto
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Email"
              value={formData.email}
              onChange={(v) => updateField('email', v)}
              error={errors.email}
              required
              type="email"
            />
            <FormField
              label="Telefono"
              value={formData.phone}
              onChange={(v) => updateField('phone', v)}
            />
            <FormField
              label="Direccion"
              value={formData.address}
              onChange={(v) => updateField('address', v)}
            />
            <FormField
              label="Ciudad"
              value={formData.city}
              onChange={(v) => updateField('city', v)}
            />
            <FormField
              label="Codigo Postal"
              value={formData.postalCode}
              onChange={(v) => updateField('postalCode', v)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Configuracion
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="MCC (Merchant Category Code)"
              value={formData.mcc}
              onChange={(v) => updateField('mcc', v)}
              error={errors.mcc}
              required
              placeholder="5812"
            />
            <FormField
              label="Porcentaje Split (%)"
              value={formData.splitPercentage}
              onChange={(v) => updateField('splitPercentage', v)}
              type="number"
              inputMode="decimal"
            />
            {isEditing && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Estado
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="SUSPENDED">Suspendido</option>
                  <option value="DEACTIVATED">Desactivado</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/merchants')}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Comercio'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  error,
  required,
  type = 'text',
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  type?: string
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email'
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-card-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 ${
          error ? 'border-destructive focus:border-destructive' : 'border-input focus:border-ring'
        }`}
      />
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

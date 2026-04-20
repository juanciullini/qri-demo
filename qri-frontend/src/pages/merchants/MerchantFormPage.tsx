import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from 'lucide-react'
import { useMerchant, useCreateMerchant, useUpdateMerchant } from '@/hooks/useMerchants'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface MccRow {
  mcc: string
  desc: string
  commission: string
}

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
  mccCodes: MccRow[]
  splitPercentage: string
  status: string
}

const emptyMccRow: MccRow = { mcc: '', desc: '', commission: '' }

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
  mccCodes: [{ ...emptyMccRow }],
  splitPercentage: '100',
  status: 'PENDING',
}

type SimpleField = Exclude<keyof FormData, 'mccCodes'>
type FieldErrors = Partial<Record<SimpleField, string>> & {
  mccCodes?: Array<Partial<Record<keyof MccRow, string>>>
  mccCodesGeneral?: string
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
  const [errors, setErrors] = useState<FieldErrors>({})
  const [initialized, setInitialized] = useState(!isEditing)

  useEffect(() => {
    if (isEditing && merchant && !initialized) {
      const existingRows: MccRow[] =
        merchant.mccCodes && merchant.mccCodes.length > 0
          ? merchant.mccCodes.map((c) => ({
              mcc: c.mcc ?? '',
              desc: c.desc ?? '',
              commission:
                c.commission !== undefined && c.commission !== null
                  ? String(c.commission)
                  : '',
            }))
          : merchant.mcc
            ? [{ mcc: merchant.mcc, desc: '', commission: '' }]
            : [{ ...emptyMccRow }]

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
        mccCodes: existingRows,
        splitPercentage: '100',
        status: merchant.status ?? 'PENDING',
      })
      setInitialized(true)
    }
  }, [isEditing, merchant, initialized])

  const loading = createMutation.isPending || updateMutation.isPending

  function updateField(key: SimpleField, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function updateMccRow(index: number, field: keyof MccRow, value: string) {
    setFormData((prev) => {
      const nextRows = prev.mccCodes.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      )
      return { ...prev, mccCodes: nextRows }
    })
    setErrors((prev) => {
      if (!prev.mccCodes && !prev.mccCodesGeneral) return prev
      const next = { ...prev }
      if (next.mccCodes) {
        const rowErrors = next.mccCodes.slice()
        if (rowErrors[index]) {
          const rowCopy = { ...rowErrors[index] }
          delete rowCopy[field]
          rowErrors[index] = rowCopy
          next.mccCodes = rowErrors
        }
      }
      delete next.mccCodesGeneral
      return next
    })
  }

  function addMccRow() {
    setFormData((prev) => ({
      ...prev,
      mccCodes: [...prev.mccCodes, { ...emptyMccRow }],
    }))
  }

  function removeMccRow(index: number) {
    setFormData((prev) => ({
      ...prev,
      mccCodes:
        prev.mccCodes.length <= 1
          ? prev.mccCodes
          : prev.mccCodes.filter((_, i) => i !== index),
    }))
  }

  function validate(): boolean {
    const newErrors: FieldErrors = {}

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

    if (formData.mccCodes.length === 0) {
      newErrors.mccCodesGeneral = 'Agrega al menos un MCC'
    } else {
      const rowErrors = formData.mccCodes.map((row) => {
        const rowErr: Partial<Record<keyof MccRow, string>> = {}
        if (!row.mcc.trim()) {
          rowErr.mcc = 'MCC es requerido'
        } else if (!/^\d{4}$/.test(row.mcc)) {
          rowErr.mcc = 'MCC debe tener 4 digitos'
        }
        if (!row.desc.trim()) rowErr.desc = 'Descripcion es requerida'
        if (!row.commission.trim()) {
          rowErr.commission = 'Comision es requerida'
        } else {
          const num = Number(row.commission)
          if (Number.isNaN(num) || num < 0 || num > 100) {
            rowErr.commission = 'Comision entre 0 y 100'
          }
        }
        return rowErr
      })
      if (rowErrors.some((r) => Object.keys(r).length > 0)) {
        newErrors.mccCodes = rowErrors
      }
    }

    setErrors(newErrors)
    return (
      Object.keys(newErrors).filter((k) => k !== 'mccCodes').length === 0 &&
      !newErrors.mccCodes
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const mccCodesPayload = formData.mccCodes.map((row) => ({
      mcc: row.mcc.trim(),
      desc: row.desc.trim(),
      commission: Number(row.commission),
    }))

    if (isEditing && id) {
      updateMutation.mutate(
        {
          id,
          data: {
            name: formData.name,
            cbu: formData.cbu,
            mccCodes: mccCodesPayload,
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
          mccCodes: mccCodesPayload,
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-card-foreground">
              MCC (Merchant Category Codes)
            </h2>
            <button
              type="button"
              onClick={addMccRow}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar MCC
            </button>
          </div>
          {errors.mccCodesGeneral && (
            <p className="mb-2 text-xs text-destructive">
              {errors.mccCodesGeneral}
            </p>
          )}
          <div className="space-y-3">
            {formData.mccCodes.map((row, index) => {
              const rowErrors = errors.mccCodes?.[index]
              return (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_1fr_auto] sm:items-start"
                >
                  <FormField
                    label={index === 0 ? 'MCC' : ''}
                    value={row.mcc}
                    onChange={(v) =>
                      updateMccRow(index, 'mcc', v.replace(/\D/g, '').slice(0, 4))
                    }
                    error={rowErrors?.mcc}
                    required={index === 0}
                    placeholder="5812"
                    inputMode="numeric"
                  />
                  <FormField
                    label={index === 0 ? 'Descripcion' : ''}
                    value={row.desc}
                    onChange={(v) => updateMccRow(index, 'desc', v)}
                    error={rowErrors?.desc}
                    required={index === 0}
                    placeholder="Restaurantes"
                  />
                  <FormField
                    label={index === 0 ? 'Comision (%)' : ''}
                    value={row.commission}
                    onChange={(v) => updateMccRow(index, 'commission', v)}
                    error={rowErrors?.commission}
                    required={index === 0}
                    placeholder="1.5"
                    type="number"
                    inputMode="decimal"
                  />
                  <div className={index === 0 ? 'sm:pt-7' : ''}>
                    <button
                      type="button"
                      onClick={() => removeMccRow(index)}
                      disabled={formData.mccCodes.length <= 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Eliminar MCC"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Configuracion
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-card-foreground">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}
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

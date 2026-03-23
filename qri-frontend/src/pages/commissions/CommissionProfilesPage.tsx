import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import {
  useCommissionProfiles,
  useCreateProfileMutation,
  useUpdateProfileMutation,
  useDeleteProfileMutation,
} from '@/hooks/useCommissions'
import DataTable from '@/components/ui/DataTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Column } from '@/components/ui/DataTable'
import type { CommissionProfile, CommissionProfileRate } from '@/types'

interface ProfileFormData {
  name: string
  description: string
  is_default: boolean
  default_rate: number
  rates: CommissionProfileRate[]
}

const emptyForm: ProfileFormData = {
  name: '',
  description: '',
  is_default: false,
  default_rate: 1.5,
  rates: [],
}

export default function CommissionProfilesPage() {
  const navigate = useNavigate()
  const { data: profilesData, isLoading } = useCommissionProfiles()
  const createMutation = useCreateProfileMutation()
  const updateMutation = useUpdateProfileMutation()
  const deleteMutation = useDeleteProfileMutation()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileFormData>(emptyForm)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(profile: CommissionProfile) {
    setEditingId(profile.id)
    setForm({
      name: profile.name,
      description: profile.description ?? '',
      is_default: profile.isDefault,
      default_rate: profile.defaultRate,
      rates: [...profile.rates],
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function addRate() {
    setForm((f) => ({
      ...f,
      rates: [...f.rates, { mcc: '', rate: 1.0, direction: 'BOTH' as const }],
    }))
  }

  function removeRate(idx: number) {
    setForm((f) => ({
      ...f,
      rates: f.rates.filter((_, i) => i !== idx),
    }))
  }

  function updateRate(idx: number, field: string, value: string | number) {
    setForm((f) => ({
      ...f,
      rates: f.rates.map((r, i) =>
        i === idx ? { ...r, [field]: value } : r,
      ),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description || undefined,
      is_default: form.is_default,
      default_rate: form.default_rate,
      rates: form.rates.filter((r) => r.mcc.length === 4),
    }

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    closeForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este perfil de comisiones?')) return
    await deleteMutation.mutateAsync(id)
  }

  const columns: Column<CommissionProfile>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <div>
          <span className="text-sm font-medium text-card-foreground">
            {row.name}
          </span>
          {row.isDefault && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'defaultRate',
      header: 'Tasa Default',
      render: (row) => (
        <span className="text-sm text-card-foreground">
          {row.defaultRate}%
        </span>
      ),
    },
    {
      key: 'rates',
      header: 'Tasas MCC',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.rates.length} tasas
        </span>
      ),
    },
    {
      key: 'merchantCount',
      header: 'Comercios',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.merchantCount}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            row.isActive
              ? 'bg-green-50 text-success'
              : 'bg-red-50 text-error'
          }`}
        >
          {row.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(row)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return <LoadingSpinner className="py-12" label="Cargando perfiles..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/commissions')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            Perfiles de Comisiones
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo Perfil
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={profilesData?.data ?? []}
        rowKey={(row) => row.id}
      />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                {editingId ? 'Editar Perfil' : 'Nuevo Perfil'}
              </h2>
              <button
                onClick={closeForm}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-card-foreground">
                  Descripcion
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-card-foreground">
                    Tasa Default (%)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    required
                    value={form.default_rate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        default_rate: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-card-foreground">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          is_default: e.target.checked,
                        }))
                      }
                      className="rounded border-border"
                    />
                    Default
                  </label>
                </div>
              </div>

              {/* Rates */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-card-foreground">
                    Tasas por MCC
                  </label>
                  <button
                    type="button"
                    onClick={addRate}
                    className="text-xs text-primary hover:underline"
                  >
                    + Agregar
                  </button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {form.rates.map((rate, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="MCC"
                        maxLength={4}
                        value={rate.mcc}
                        onChange={(e) =>
                          updateRate(idx, 'mcc', e.target.value)
                        }
                        className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={rate.rate}
                        onChange={(e) =>
                          updateRate(idx, 'rate', Number(e.target.value))
                        }
                        className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                        placeholder="%"
                      />
                      <select
                        value={rate.direction}
                        onChange={(e) =>
                          updateRate(idx, 'direction', e.target.value)
                        }
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      >
                        <option value="BOTH">Ambos</option>
                        <option value="INBOUND">Cobro</option>
                        <option value="OUTBOUND">Pago</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeRate(idx)}
                        className="rounded p-1 text-muted-foreground hover:text-error"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {form.rates.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sin tasas especificas. Se usara la tasa default.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {editingId ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

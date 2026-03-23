import { useState } from 'react'
import { Plus, Search, Edit, Trash2, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser } from '@/services/users.service'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatDateAR } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { User } from '@/types'

const roleColors: Record<string, string> = {
  ADMIN: 'text-red-700 bg-red-50 border-red-200',
  OPERATOR: 'text-blue-700 bg-blue-50 border-blue-200',
  MERCHANT: 'text-green-700 bg-green-50 border-green-200',
  VIEWER: 'text-gray-700 bg-gray-50 border-gray-200',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  MERCHANT: 'Comercio',
  VIEWER: 'Visualizador',
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<User['role']>('VIEWER')
  const [formMerchantId, setFormMerchantId] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', roleFilter, search, page],
    queryFn: () =>
      getUsers({
        role: (roleFilter || undefined) as User['role'] | undefined,
        search: search || undefined,
        page,
        limit: 20,
      }),
  })

  const users = data?.data ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        merchantId: formMerchantId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateUser(editingUser!.id, {
        name: formName,
        email: formEmail,
        role: formRole,
        merchantId: formMerchantId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  function openCreate() {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('VIEWER')
    setFormMerchantId('')
    setShowModal(true)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword('')
    setFormRole(user.role)
    setFormMerchantId(user.merchantId ?? '')
    setShowModal(true)
  }

  function handleSave() {
    if (editingUser) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Confirma la eliminacion de este usuario?')) return
    deleteMutation.mutate(id)
  }

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <span className="font-medium text-card-foreground">{row.name}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (row) => (
        <StatusBadge
          status={row.role}
          colorFn={(r) => roleColors[r] ?? 'text-gray-700 bg-gray-50 border-gray-200'}
          label={roleLabels[row.role] ?? row.role}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDateAR(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(row)
            }}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(row.id)
            }}
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-error"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los roles</option>
          <option value="ADMIN">Administrador</option>
          <option value="OPERATOR">Operador</option>
          <option value="MERCHANT">Comercio</option>
          <option value="VIEWER">Visualizador</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-12" label="Cargando usuarios..." />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Error al cargar los usuarios. Intente nuevamente.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          rowKey={(row) => row.id}
          page={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Nombre <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Contrasena{' '}
                  {!editingUser && <span className="text-destructive">*</span>}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? 'Dejar vacio para no cambiar' : ''}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Rol <span className="text-destructive">*</span>
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as User['role'])}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="OPERATOR">Operador</option>
                  <option value="MERCHANT">Comercio</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
              </div>
              {formRole === 'MERCHANT' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                    ID de Comercio
                  </label>
                  <input
                    type="text"
                    value={formMerchantId}
                    onChange={(e) => setFormMerchantId(e.target.value)}
                    placeholder="ID del comercio asociado"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

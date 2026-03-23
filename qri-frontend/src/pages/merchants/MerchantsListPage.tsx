import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useMerchantsList } from '@/hooks/useMerchants'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatCuit, merchantStatusColor } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { Merchant } from '@/types'

export default function MerchantsListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canCreate = user?.role === 'ADMIN' || user?.role === 'OPERATOR'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useMerchantsList({
    page,
    limit: 20,
    status: (statusFilter || undefined) as Merchant['status'] | undefined,
    search: search || undefined,
  })

  const columns: Column<Merchant>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <span className="font-medium text-card-foreground">{row.name}</span>
      ),
    },
    {
      key: 'cuit',
      header: 'CUIT',
      render: (row) => (
        <span className="font-mono text-sm">{formatCuit(row.cuit)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <StatusBadge status={row.status} colorFn={merchantStatusColor} />
      ),
    },
    {
      key: 'mcc',
      header: 'MCC',
      render: (row) => <span className="text-sm">{row.mcc}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.email}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/merchants/${row.id}`)
          }}
          className="text-sm text-primary hover:underline"
        >
          Ver detalle
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Comercios</h1>
        {canCreate && (
          <button
            onClick={() => navigate('/merchants/new')}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nuevo Comercio
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="PENDING">Pendiente</option>
          <option value="SUSPENDED">Suspendido</option>
          <option value="DEACTIVATED">Desactivado</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-12" label="Cargando comercios..." />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Error al cargar los comercios. Intente nuevamente.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          onRowClick={(row) => navigate(`/merchants/${row.id}`)}
          rowKey={(row) => row.id}
          page={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

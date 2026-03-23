import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { getSettlements } from '@/services/settlements.service'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateShort } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { Settlement } from '@/types'

const settlementStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'text-success bg-green-50 border-green-200'
    case 'PROCESSING':
      return 'text-primary bg-blue-50 border-blue-200'
    case 'PENDING':
      return 'text-warning bg-amber-50 border-amber-200'
    case 'FAILED':
      return 'text-error bg-red-50 border-red-200'
    default:
      return 'text-muted-foreground bg-gray-50 border-gray-200'
  }
}

const settlementStatusLabel: Record<string, string> = {
  COMPLETED: 'Completada',
  PROCESSING: 'Procesando',
  PENDING: 'Pendiente',
  FAILED: 'Fallida',
}

export default function SettlementsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canCreate = user?.role === 'ADMIN'

  const [statusFilter, setStatusFilter] = useState<string>('')
  const [merchantSearch, setMerchantSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settlements', statusFilter, page],
    queryFn: () =>
      getSettlements({
        status: (statusFilter || undefined) as Settlement['status'] | undefined,
        page,
        limit: 20,
      }),
  })

  const settlements = data?.data ?? []

  const filtered = merchantSearch
    ? settlements.filter((s) =>
        s.merchantName.toLowerCase().includes(merchantSearch.toLowerCase()),
      )
    : settlements

  const columns: Column<Settlement>[] = [
    {
      key: 'period',
      header: 'Periodo',
      render: (row) => (
        <span className="text-sm text-card-foreground">
          {formatDateShort(row.periodFrom)} - {formatDateShort(row.periodTo)}
        </span>
      ),
    },
    {
      key: 'merchantName',
      header: 'Comercio',
      render: (row) => (
        <span className="text-sm font-medium text-card-foreground">
          {row.merchantName}
        </span>
      ),
    },
    {
      key: 'transactionCount',
      header: 'Transacciones',
      render: (row) => (
        <span className="text-sm text-card-foreground">
          {row.transactionCount}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'amount',
      header: 'Total',
      render: (row) => (
        <span className="text-sm font-medium text-card-foreground">
          {formatMoney(row.amount)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <StatusBadge
          status={row.status}
          colorFn={settlementStatusColor}
          label={settlementStatusLabel[row.status] ?? row.status}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Liquidaciones</h1>
        {canCreate && (
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Generar Liquidacion
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={merchantSearch}
            onChange={(e) => setMerchantSearch(e.target.value)}
            placeholder="Buscar por comercio..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PROCESSING">Procesando</option>
          <option value="COMPLETED">Completada</option>
          <option value="FAILED">Fallida</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-12" label="Cargando liquidaciones..." />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Error al cargar las liquidaciones. Intente nuevamente.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => navigate(`/settlements/${row.id}`)}
          rowKey={(row) => row.id}
          page={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

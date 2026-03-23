import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Wifi, WifiOff, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useTransactionsList, useTransactionSocket } from '@/hooks/useTransactions'
import { useSocket } from '@/hooks/useSocket'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateAR, txStatusColor } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { Transaction, TxDirection } from '@/types'

export default function TransactionsPage() {
  const navigate = useNavigate()

  const [directionFilter, setDirectionFilter] = useState<'' | TxDirection>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [merchantFilter, setMerchantFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { isConnected } = useSocket()
  useTransactionSocket()

  const { data, isLoading, isError } = useTransactionsList({
    page,
    limit: 20,
    direction: (directionFilter || undefined) as TxDirection | undefined,
    status: (statusFilter || undefined) as Transaction['status'] | undefined,
    qr_id_trx: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  const columns: Column<Transaction>[] = [
    {
      key: 'qrIdTrx',
      header: 'ID',
      render: (row) => (
        <span className="font-mono text-xs text-card-foreground">
          {row.qrIdTrx}
        </span>
      ),
    },
    {
      key: 'direction',
      header: 'Tipo',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
          row.direction === 'OUTBOUND' ? 'text-primary' : 'text-success'
        }`}>
          {row.direction === 'OUTBOUND' ? (
            <><ArrowUpRight className="h-3.5 w-3.5" /> Pago</>
          ) : (
            <><ArrowDownLeft className="h-3.5 w-3.5" /> Cobro</>
          )}
        </span>
      ),
    },
    {
      key: 'merchantName',
      header: 'Comercio',
      render: (row) => (
        <span className="text-sm font-medium text-card-foreground">
          {row.direction === 'OUTBOUND'
            ? (row.externalMerchantName ?? row.merchantName)
            : row.merchantName}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Monto',
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
        <StatusBadge status={row.status} colorFn={txStatusColor} />
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDateAR(row.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Transacciones</h1>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isConnected
              ? 'bg-green-50 text-success'
              : 'bg-red-50 text-error'
          }`}
        >
          {isConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {isConnected ? 'Tiempo real' : 'Desconectado'}
        </div>
      </div>

      {/* Direction Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        {([
          { value: '' as const, label: 'Todos' },
          { value: 'INBOUND' as const, label: 'Cobros (Entrantes)' },
          { value: 'OUTBOUND' as const, label: 'Pagos (Salientes)' },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setDirectionFilter(tab.value); setPage(1); }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              directionFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID..."
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Todos los estados</option>
            <option value="CREADO">Creado</option>
            <option value="EN_CURSO">En Curso</option>
            <option value="ACREDITADO">Acreditado</option>
            <option value="REVERSADO">Reversado</option>
            <option value="DEVUELTO">Devuelto</option>
          </select>

          <input
            type="text"
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            placeholder="Comercio..."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-12" label="Cargando transacciones..." />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Error al cargar las transacciones. Intente nuevamente.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          onRowClick={(row) => navigate(`/transactions/${row.id}`)}
          rowKey={(row) => row.id}
          page={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

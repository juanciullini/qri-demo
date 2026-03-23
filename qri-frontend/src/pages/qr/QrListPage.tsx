import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, QrCode, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { getQrCodes } from '@/services/qr.service'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateAR } from '@/lib/utils'
import type { QrCode as QrCodeType } from '@/types'

const qrStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'text-success bg-green-50 border-green-200'
    case 'EXPIRED':
      return 'text-warning bg-amber-50 border-amber-200'
    case 'DELETED':
      return 'text-error bg-red-50 border-red-200'
    default:
      return 'text-muted-foreground bg-gray-50 border-gray-200'
  }
}

export default function QrListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canGenerate =
    user?.role === 'ADMIN' ||
    user?.role === 'OPERATOR' ||
    user?.role === 'MERCHANT'

  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['qr', 'list', typeFilter, statusFilter],
    queryFn: () =>
      getQrCodes({
        type: (typeFilter || undefined) as QrCodeType['type'] | undefined,
        status: (statusFilter || undefined) as QrCodeType['status'] | undefined,
      }),
  })

  const qrCodes = data?.data ?? []

  const filtered = search
    ? qrCodes.filter((item) => {
        const q = search.toLowerCase()
        return (
          item.alias.toLowerCase().includes(q) ||
          item.merchantName.toLowerCase().includes(q)
        )
      })
    : qrCodes

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Codigos QR</h1>
        {canGenerate && (
          <button
            onClick={() => navigate('/qr/generate')}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Generar QR
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
            placeholder="Buscar por alias o comercio..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los tipos</option>
          <option value="STATIC">Estatico</option>
          <option value="DYNAMIC">Dinamico</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="EXPIRED">Expirado</option>
          <option value="DELETED">Eliminado</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-12" label="Cargando codigos QR..." />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Error al cargar los codigos QR. Intente nuevamente.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center shadow-sm">
          <QrCode className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            No se encontraron codigos QR
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((qr) => (
            <div
              key={qr.id}
              className="rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-card-foreground">
                    {qr.alias}
                  </span>
                </div>
                <StatusBadge status={qr.status} colorFn={qrStatusColor} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium text-card-foreground">
                    {qr.type === 'STATIC' ? 'Estatico' : 'Dinamico'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comercio</span>
                  <span className="text-card-foreground">
                    {qr.merchantName}
                  </span>
                </div>
                {qr.amount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monto</span>
                    <span className="font-medium text-card-foreground">
                      {formatMoney(qr.amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateAR(qr.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

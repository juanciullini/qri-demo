import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  Pause,
  Trash2,
  QrCode,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import {
  useMerchant,
  useMerchantStats,
  useActivateMerchant,
  useSuspendMerchant,
  useDeleteMerchant,
} from '@/hooks/useMerchants'
import { useQuery } from '@tanstack/react-query'
import { getQrCodes } from '@/services/qr.service'
import StatusBadge from '@/components/ui/StatusBadge'
import StatsCard from '@/components/ui/StatsCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatCuit, formatMoney, merchantStatusColor, formatDateAR } from '@/lib/utils'
import { ArrowLeftRight, DollarSign, TrendingUp } from 'lucide-react'

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OPERATOR'

  const { data: merchant, isLoading, isError } = useMerchant(id ?? '')
  const { data: stats } = useMerchantStats(id ?? '')
  const { data: qrData } = useQuery({
    queryKey: ['qr', 'merchant', id],
    queryFn: () => getQrCodes({ merchant_id: id }),
    enabled: !!id,
  })

  const activateMutation = useActivateMerchant()
  const suspendMutation = useSuspendMerchant()
  const deleteMutation = useDeleteMerchant()

  const qrCodes = qrData?.data ?? []

  function handleActivate() {
    if (id) activateMutation.mutate(id)
  }

  function handleSuspend() {
    if (id) suspendMutation.mutate(id)
  }

  function handleDelete() {
    if (!id || !confirm('Confirma la eliminacion de este comercio?')) return
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/merchants'),
    })
  }

  if (isLoading) {
    return <LoadingSpinner className="py-12" label="Cargando comercio..." />
  }

  if (isError || !merchant) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Error al cargar el comercio. Intente nuevamente.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/merchants')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {merchant.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              CUIT: {formatCuit(merchant.cuit)}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/merchants/${merchant.id}/edit`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              <Edit className="h-4 w-4" />
              Editar
            </button>
            {merchant.status === 'SUSPENDED' ? (
              <button
                onClick={handleActivate}
                disabled={activateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Activar
              </button>
            ) : merchant.status === 'ACTIVE' ? (
              <button
                onClick={handleSuspend}
                disabled={suspendMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-warning px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
              >
                <Pause className="h-4 w-4" />
                Suspender
              </button>
            ) : null}
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Merchant Info */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">
          Informacion del Comercio
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Nombre" value={merchant.name} />
          <InfoField label="CUIT" value={formatCuit(merchant.cuit)} />
          <InfoField label="CBU" value={merchant.cbu} mono />
          <InfoField label="MCC" value={merchant.mcc} />
          <InfoField label="Email" value={merchant.email} />
          <InfoField label="Telefono" value={merchant.phone ?? '-'} />
          <InfoField label="Direccion" value={merchant.address ?? '-'} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estado</p>
            <div className="mt-1">
              <StatusBadge
                status={merchant.status}
                colorFn={merchantStatusColor}
              />
            </div>
          </div>
          <InfoField label="Creado" value={formatDateAR(merchant.createdAt)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          icon={ArrowLeftRight}
          label="Total Transacciones"
          value={(stats?.totalTransactions ?? 0).toLocaleString('es-AR')}
        />
        <StatsCard
          icon={DollarSign}
          label="Volumen Total"
          value={formatMoney(stats?.totalAmount ?? 0)}
        />
        <StatsCard
          icon={TrendingUp}
          label="Ticket Promedio"
          value={formatMoney(stats?.averageTicket ?? 0)}
        />
        <StatsCard
          icon={QrCode}
          label="QR Activos"
          value={stats?.activeQrCodes ?? 0}
        />
      </div>

      {/* QR Codes */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">
            Codigos QR Asociados
          </h2>
        </div>
        <div className="divide-y divide-border">
          {qrCodes.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              No hay codigos QR asociados
            </p>
          ) : (
            qrCodes.map((qr) => (
              <div
                key={qr.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      {qr.alias}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {qr.type === 'STATIC' ? 'Estatico' : 'Dinamico'} -{' '}
                      {formatDateAR(qr.createdAt)}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  status={qr.status}
                  colorFn={(s) =>
                    s === 'ACTIVE'
                      ? 'text-success bg-green-50 border-green-200'
                      : s === 'EXPIRED'
                        ? 'text-warning bg-amber-50 border-amber-200'
                        : 'text-error bg-red-50 border-red-200'
                  }
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function InfoField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-sm text-card-foreground ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

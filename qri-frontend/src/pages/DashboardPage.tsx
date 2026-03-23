import { useMemo } from 'react'
import {
  ArrowLeftRight,
  DollarSign,
  TrendingUp,
  CalendarDays,
  AlertTriangle,
  Wallet,
  Percent,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useTransactionStats, useTransactionsList } from '@/hooks/useTransactions'
import { useCommissionDashboard } from '@/hooks/useCommissions'
import StatsCard from '@/components/ui/StatsCard'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateAR, txStatusColor } from '@/lib/utils'

// -- Mock data for features without endpoints --

const mockVolumeByDay = [
  { date: 'Lun', count: 420, amount: 1250000 },
  { date: 'Mar', count: 380, amount: 1180000 },
  { date: 'Mie', count: 450, amount: 1420000 },
  { date: 'Jue', count: 510, amount: 1650000 },
  { date: 'Vie', count: 480, amount: 1530000 },
  { date: 'Sab', count: 220, amount: 680000 },
  { date: 'Dom', count: 150, amount: 450000 },
]

const mockAlerts = [
  {
    id: '1',
    message: 'Latencia COELSA elevada (>500ms)',
    level: 'warning' as const,
    time: '14:25',
  },
  {
    id: '2',
    message: '3 transacciones reversadas en los ultimos 30 min',
    level: 'error' as const,
    time: '14:10',
  },
]

const STATUS_COLORS: Record<string, string> = {
  ACREDITADO: '#22c55e',
  EN_CURSO: '#2563eb',
  REVERSADO: '#ef4444',
  DEVUELTO: '#f59e0b',
  CREADO: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  ACREDITADO: 'Acreditado',
  EN_CURSO: 'En Curso',
  REVERSADO: 'Reversado',
  DEVUELTO: 'Devuelto',
  CREADO: 'Creado',
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useTransactionStats()
  const { data: outboundStats, isLoading: outboundStatsLoading } = useTransactionStats({ direction: 'OUTBOUND' })
  const { data: recentTxData, isLoading: recentLoading } = useTransactionsList({ page: 1, limit: 5 })

  // Commission dashboard (last 30 days)
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString()
  }, [])
  const { data: commDashboard } = useCommissionDashboard({ date_from: thirtyDaysAgo })

  const recentTransactions = recentTxData?.data ?? []

  const statusDistribution = useMemo(() => {
    if (!stats?.byStatus) return []
    return Object.entries(stats.byStatus).map(([key, value]) => ({
      name: STATUS_LABELS[key] ?? key,
      value,
      color: STATUS_COLORS[key] ?? '#6b7280',
    }))
  }, [stats?.byStatus])

  const successRate = useMemo(() => {
    if (!stats?.byStatus || !stats.totalCount) return 0
    const acreditado = stats.byStatus.ACREDITADO ?? 0
    return stats.totalCount > 0 ? ((acreditado / stats.totalCount) * 100) : 0
  }, [stats])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* Stats Cards */}
      {statsLoading ? (
        <LoadingSpinner className="py-6" label="Cargando estadisticas..." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            icon={ArrowLeftRight}
            label="Total Transacciones"
            value={(stats?.totalCount ?? 0).toLocaleString('es-AR')}
          />
          <StatsCard
            icon={DollarSign}
            label="Monto Total"
            value={formatMoney(stats?.totalAmount ?? 0)}
          />
          <StatsCard
            icon={TrendingUp}
            label="Tasa de Exito"
            value={`${successRate.toFixed(1)}%`}
          />
          <StatsCard
            icon={CalendarDays}
            label="Ticket Promedio"
            value={formatMoney(stats?.averageAmount ?? 0)}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Volume chart */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Volumen de Transacciones
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.byDay?.length ? stats.byDay : mockVolumeByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [
                  Number(value ?? 0).toLocaleString('es-AR'),
                  'Transacciones',
                ]}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Distribucion por Estado
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {statusDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [
                  Number(value ?? 0).toLocaleString('es-AR'),
                  'Transacciones',
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outbound (Wallet) Stats */}
      {outboundStatsLoading ? (
        <LoadingSpinner className="py-4" label="Cargando estadisticas de pagos..." />
      ) : outboundStats && outboundStats.totalCount > 0 ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Pagos Realizados (Billetera)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard
              icon={Wallet}
              label="Total Pagos"
              value={(outboundStats.totalCount ?? 0).toLocaleString('es-AR')}
            />
            <StatsCard
              icon={DollarSign}
              label="Monto Pagado"
              value={formatMoney(outboundStats.totalAmount ?? 0)}
            />
            <StatsCard
              icon={TrendingUp}
              label="Tasa de Exito Pagos"
              value={`${(outboundStats.totalCount > 0
                ? ((outboundStats.byStatus?.ACREDITADO ?? 0) / outboundStats.totalCount * 100)
                : 0
              ).toFixed(1)}%`}
            />
          </div>
        </div>
      ) : null}

      {/* Commission Stats (30 days) */}
      {commDashboard && commDashboard.totals.txCount > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Comisiones (30 dias)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard
              icon={DollarSign}
              label="Total Comisiones"
              value={formatMoney(commDashboard.totals.totalCommissions)}
            />
            <StatsCard
              icon={Percent}
              label="Tasa Promedio"
              value={`${commDashboard.totals.avgRate.toFixed(2)}%`}
            />
            <StatsCard
              icon={TrendingUp}
              label="Neto Comercios"
              value={formatMoney(commDashboard.totals.totalMerchantNet)}
            />
          </div>
        </div>
      )}

      {/* Bottom section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="col-span-1 rounded-lg border border-border bg-card shadow-sm lg:col-span-2">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-card-foreground">
              Transacciones Recientes
            </h2>
          </div>
          {recentLoading ? (
            <LoadingSpinner className="py-8" />
          ) : (
            <div className="divide-y divide-border">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      {tx.merchantName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateAR(tx.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-card-foreground">
                      {formatMoney(tx.amount)}
                    </span>
                    <StatusBadge status={tx.status} colorFn={txStatusColor} />
                  </div>
                </div>
              ))}
              {recentTransactions.length === 0 && (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  No hay transacciones recientes
                </p>
              )}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-card-foreground">
              Alertas del Sistema
            </h2>
          </div>
          <div className="divide-y divide-border">
            {mockAlerts.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                Sin alertas activas
              </p>
            ) : (
              mockAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 px-6 py-3">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.level === 'error'
                        ? 'text-error'
                        : 'text-warning'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-card-foreground">
                      {alert.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert.time}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

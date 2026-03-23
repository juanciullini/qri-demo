import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  Percent,
  TrendingUp,
  ArrowDownLeft,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useCommissionDashboard } from '@/hooks/useCommissions'
import StatsCard from '@/components/ui/StatsCard'
import DataTable from '@/components/ui/DataTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateShort } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { CommissionByMerchant, CommissionByMcc, CommissionDashboardFilters } from '@/types'

export default function CommissionsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<CommissionDashboardFilters>({
    granularity: 'day',
  })

  const { data: dashboard, isLoading } = useCommissionDashboard(filters)

  const chartData = useMemo(() => {
    if (!dashboard?.dailyEvolution) return []
    return dashboard.dailyEvolution.map((d) => ({
      date: formatDateShort(d.period),
      Bruto: d.gross,
      Comision: d.commission,
    }))
  }, [dashboard?.dailyEvolution])

  const merchantColumns: Column<CommissionByMerchant>[] = [
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
      key: 'gross',
      header: 'Bruto',
      render: (row) => (
        <span className="text-sm text-card-foreground">
          {formatMoney(row.gross)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'commission',
      header: 'Comision',
      render: (row) => (
        <span className="text-sm font-medium text-error">
          {formatMoney(row.commission)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'avgRate',
      header: 'Tasa',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.avgRate.toFixed(2)}%
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'txCount',
      header: 'Txs',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.txCount.toLocaleString('es-AR')}
        </span>
      ),
      className: 'text-right',
    },
  ]

  const mccColumns: Column<CommissionByMcc>[] = [
    {
      key: 'mcc',
      header: 'MCC',
      render: (row) => (
        <span className="font-mono text-sm text-card-foreground">
          {row.mcc}
        </span>
      ),
    },
    {
      key: 'gross',
      header: 'Bruto',
      render: (row) => (
        <span className="text-sm text-card-foreground">
          {formatMoney(row.gross)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'commission',
      header: 'Comision',
      render: (row) => (
        <span className="text-sm font-medium text-error">
          {formatMoney(row.commission)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'avgRate',
      header: 'Tasa',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.avgRate.toFixed(2)}%
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'txCount',
      header: 'Txs',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.txCount.toLocaleString('es-AR')}
        </span>
      ),
      className: 'text-right',
    },
  ]

  if (isLoading) {
    return <LoadingSpinner className="py-12" label="Cargando comisiones..." />
  }

  const totals = dashboard?.totals

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Comisiones</h1>
        <button
          onClick={() => navigate('/commissions/profiles')}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          Gestionar Perfiles
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.granularity ?? 'day'}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              granularity: e.target.value as 'day' | 'week' | 'month',
            }))
          }
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground"
        >
          <option value="day">Diario</option>
          <option value="week">Semanal</option>
          <option value="month">Mensual</option>
        </select>
        <input
          type="date"
          value={filters.date_from ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              date_from: e.target.value || undefined,
            }))
          }
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground"
          placeholder="Desde"
        />
        <input
          type="date"
          value={filters.date_to ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              date_to: e.target.value || undefined,
            }))
          }
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground"
          placeholder="Hasta"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          icon={DollarSign}
          label="Total Comisiones"
          value={formatMoney(totals?.totalCommissions ?? 0)}
        />
        <StatsCard
          icon={Percent}
          label="Tasa Promedio"
          value={`${(totals?.avgRate ?? 0).toFixed(2)}%`}
        />
        <StatsCard
          icon={TrendingUp}
          label="Comision Prom/Tx"
          value={
            totals && totals.txCount > 0
              ? formatMoney(totals.totalCommissions / totals.txCount)
              : formatMoney(0)
          }
        />
        <StatsCard
          icon={ArrowDownLeft}
          label="Total Neto Comercios"
          value={formatMoney(totals?.totalMerchantNet ?? 0)}
        />
      </div>

      {/* Evolution Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Evolucion Temporal
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [
                  formatMoney(value),
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Bruto"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Comision"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By Merchant */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Desglose por Comercio
        </h2>
        <DataTable
          columns={merchantColumns}
          data={dashboard?.byMerchant ?? []}
          rowKey={(row) => row.merchantId}
        />
      </div>

      {/* By MCC */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Desglose por MCC
        </h2>
        <DataTable
          columns={mccColumns}
          data={dashboard?.byMcc ?? []}
          rowKey={(row) => row.mcc}
        />
      </div>
    </div>
  )
}

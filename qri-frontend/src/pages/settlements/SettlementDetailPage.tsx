import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getSettlement } from '@/services/settlements.service'
import { getTransactions } from '@/services/transactions.service'
import StatusBadge from '@/components/ui/StatusBadge'
import DataTable from '@/components/ui/DataTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateAR, formatDateShort, txStatusColor } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { Transaction } from '@/types'

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

export default function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: settlement, isLoading, isError } = useQuery({
    queryKey: ['settlement', id],
    queryFn: () => getSettlement(id!),
    enabled: !!id,
  })

  const { data: txData } = useQuery({
    queryKey: ['settlement-transactions', settlement?.merchantId, settlement?.periodFrom, settlement?.periodTo],
    queryFn: () =>
      getTransactions({
        merchant_id: settlement!.merchantId,
        date_from: settlement!.periodFrom,
        date_to: settlement!.periodTo,
        limit: 100,
      }),
    enabled: !!settlement,
  })

  const transactions = txData?.data ?? []

  if (isLoading) {
    return <LoadingSpinner className="py-12" label="Cargando liquidacion..." />
  }

  if (isError || !settlement) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Error al cargar la liquidacion. Intente nuevamente.
      </div>
    )
  }

  const commission = settlement.totalCommission ?? settlement.amount * 0.015
  const netAmount = settlement.merchantNet ?? settlement.amount - commission
  const avgRate = settlement.avgCommissionRate ?? (settlement.amount > 0 ? (commission / settlement.amount) * 100 : 0)

  const txColumns: Column<Transaction>[] = [
    {
      key: 'qrIdTrx',
      header: 'ID TRX',
      render: (row) => (
        <span className="font-mono text-xs text-card-foreground">
          {row.qrIdTrx}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settlements')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Liquidacion {settlement.id}
            </h1>
            <p className="text-sm text-muted-foreground">
              {settlement.merchantName}
            </p>
          </div>
        </div>

        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted">
          <Download className="h-4 w-4" />
          Exportar
        </button>
      </div>

      {/* Summary Card */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">
          Resumen de Liquidacion
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Periodo
            </p>
            <p className="mt-1 text-sm text-card-foreground">
              {formatDateShort(settlement.periodFrom)} -{' '}
              {formatDateShort(settlement.periodTo)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Transacciones
            </p>
            <p className="mt-1 text-sm font-medium text-card-foreground">
              {settlement.transactionCount}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estado</p>
            <div className="mt-1">
              <StatusBadge
                status={settlement.status}
                colorFn={settlementStatusColor}
              />
            </div>
          </div>
          {settlement.settledAt && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Liquidado
              </p>
              <p className="mt-1 text-sm text-card-foreground">
                {formatDateAR(settlement.settledAt)}
              </p>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Bruto</span>
              <span className="font-medium text-card-foreground">
                {formatMoney(settlement.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Comision ({avgRate.toFixed(2)}%)
              </span>
              <span className="text-error">
                -{formatMoney(commission)}
              </span>
            </div>
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-card-foreground">
                  Total Neto
                </span>
                <span className="text-lg font-bold text-success">
                  {formatMoney(netAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Detail by MCC */}
      {settlement.commissionDetail && settlement.commissionDetail.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Desglose de Comisiones por MCC
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2">MCC</th>
                  <th className="pb-2 text-right">Txs</th>
                  <th className="pb-2 text-right">Bruto</th>
                  <th className="pb-2 text-right">Comision</th>
                  <th className="pb-2 text-right">Tasa</th>
                </tr>
              </thead>
              <tbody>
                {settlement.commissionDetail.map((detail) => (
                  <tr key={detail.mcc} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-card-foreground">
                      {detail.mcc}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {detail.txCount}
                    </td>
                    <td className="py-2 text-right text-card-foreground">
                      {formatMoney(detail.grossAmount)}
                    </td>
                    <td className="py-2 text-right text-error">
                      {formatMoney(detail.commissionAmount)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {detail.rate.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Transacciones Incluidas
        </h2>
        <DataTable
          columns={txColumns}
          data={transactions}
          rowKey={(row) => row.id}
        />
      </div>
    </div>
  )
}

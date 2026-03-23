import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useTransaction, useRefundMutation } from '@/hooks/useTransactions'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateAR, formatCuit, txStatusColor } from '@/lib/utils'

const statusIcon = (status: string) => {
  switch (status) {
    case 'CREADO':
      return <Clock className="h-4 w-4" />
    case 'EN_CURSO':
      return <RefreshCw className="h-4 w-4" />
    case 'ACREDITADO':
      return <CheckCircle className="h-4 w-4" />
    case 'REVERSADO':
    case 'DEVUELTO':
      return <XCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canRefund = user?.role === 'ADMIN' || user?.role === 'OPERATOR'

  const [showCoelsaLog, setShowCoelsaLog] = useState(false)

  const { data: txRaw, isLoading, isError } = useTransaction(id ?? '')
  const refundMutation = useRefundMutation()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullResponse = txRaw as any
  const tx = txRaw
  const timeline = fullResponse?.timeline ?? fullResponse?.status_history ?? []
  const coelsaMessages = fullResponse?.coelsa_messages ?? fullResponse?.coelsaMessages ?? []

  async function handleRefund() {
    if (!id || !confirm('Confirma la devolucion de esta transaccion?')) return
    refundMutation.mutate(
      { id, data: { reason: 'Devolucion solicitada por operador' } },
      {
        onSuccess: () => alert('Devolucion procesada exitosamente'),
        onError: () => alert('Error al procesar devolucion'),
      },
    )
  }

  if (isLoading) {
    return <LoadingSpinner className="py-12" label="Cargando transaccion..." />
  }

  if (isError || !tx) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Error al cargar la transaccion. Intente nuevamente.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                Transaccion {tx.qrIdTrx}
              </h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                tx.direction === 'OUTBOUND'
                  ? 'bg-blue-50 text-primary'
                  : 'bg-green-50 text-success'
              }`}>
                {tx.direction === 'OUTBOUND' ? (
                  <><ArrowUpRight className="h-3 w-3" /> Pago</>
                ) : (
                  <><ArrowDownLeft className="h-3 w-3" /> Cobro</>
                )}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDateAR(tx.createdAt)}
            </p>
          </div>
        </div>

        {canRefund && tx.status === 'ACREDITADO' && (
          <button
            onClick={handleRefund}
            disabled={refundMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-warning px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-warning/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refundMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Devolver
          </button>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">
          Informacion de la Transaccion
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="ID" value={tx.id} mono />
          <InfoField label="QR ID TRX" value={tx.qrIdTrx} mono />
          <InfoField label="QR ID" value={tx.qrId} mono />
          <InfoField label="Comercio" value={tx.merchantName} />
          <InfoField label="MCC" value={tx.mcc} />
          <InfoField
            label="Monto"
            value={formatMoney(tx.amount, tx.currency)}
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estado</p>
            <div className="mt-1">
              <StatusBadge status={tx.status} colorFn={txStatusColor} />
            </div>
          </div>
          {tx.direction === 'OUTBOUND' && tx.externalMerchantCuit && (
            <InfoField
              label="CUIT Comercio Externo"
              value={formatCuit(tx.externalMerchantCuit)}
            />
          )}
          {tx.direction === 'OUTBOUND' && tx.externalMerchantName && (
            <InfoField
              label="Comercio Externo"
              value={tx.externalMerchantName}
            />
          )}
          {tx.direction === 'OUTBOUND' && fullResponse?.external_merchant_cbu && (
            <InfoField
              label="CBU Comercio Externo"
              value={fullResponse.external_merchant_cbu}
              mono
            />
          )}
          {tx.payerCuit && (
            <InfoField
              label={tx.direction === 'OUTBOUND' ? 'CUIT Pagador' : 'CUIT Comprador'}
              value={formatCuit(tx.payerCuit)}
            />
          )}
          {tx.payerName && (
            <InfoField label="Nombre Pagador" value={tx.payerName} />
          )}
          {tx.coelsaRef && (
            <InfoField label="Referencia COELSA" value={tx.coelsaRef} mono />
          )}
          <InfoField label="Creado" value={formatDateAR(tx.createdAt)} />
          <InfoField
            label="Ultima Actualizacion"
            value={formatDateAR(tx.updatedAt)}
          />
        </div>
      </div>

      {/* Commission Detail */}
      {(fullResponse?.platform_commission != null || fullResponse?.commission_data) && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Detalle de Comision
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fullResponse?.platform_commission != null && (
              <InfoField
                label="Comision Plataforma"
                value={formatMoney(Number(fullResponse.platform_commission))}
              />
            )}
            {fullResponse?.merchant_net_amount != null && (
              <InfoField
                label="Neto Comercio"
                value={formatMoney(Number(fullResponse.merchant_net_amount))}
              />
            )}
            {fullResponse?.platform_commission != null && tx.amount > 0 && (
              <InfoField
                label="Tasa Aplicada"
                value={`${((Number(fullResponse.platform_commission) / tx.amount) * 100).toFixed(2)}%`}
              />
            )}
            {fullResponse?.commission_data?.importe_bruto != null && (
              <InfoField
                label="COELSA Bruto"
                value={formatMoney(fullResponse.commission_data.importe_bruto)}
              />
            )}
            {fullResponse?.commission_data?.importe_neto != null && (
              <InfoField
                label="COELSA Neto"
                value={formatMoney(fullResponse.commission_data.importe_neto)}
              />
            )}
            {fullResponse?.commission_data?.comision_comercio != null && (
              <InfoField
                label="COELSA Comision Comercio"
                value={formatMoney(fullResponse.commission_data.comision_comercio)}
              />
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Linea de Tiempo
          </h2>
          <div className="relative">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {timeline.map((event: any, idx: number) => (
              <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                {idx < timeline.length - 1 && (
                  <div className="absolute left-[15px] top-8 h-full w-0.5 bg-border" />
                )}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    event.status === 'ACREDITADO'
                      ? 'border-success bg-green-50 text-success'
                      : event.status === 'REVERSADO' ||
                          event.status === 'DEVUELTO'
                        ? 'border-error bg-red-50 text-error'
                        : 'border-primary bg-blue-50 text-primary'
                  }`}
                >
                  {statusIcon(event.status)}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={event.status}
                      colorFn={txStatusColor}
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatDateAR(event.timestamp ?? event.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-card-foreground">
                    {event.message ?? event.description ?? ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COELSA Messages */}
      {coelsaMessages.length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <button
            onClick={() => setShowCoelsaLog((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-lg font-semibold text-card-foreground">
              Mensajes COELSA ({coelsaMessages.length})
            </h2>
            {showCoelsaLog ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {showCoelsaLog && (
            <div className="border-t border-border">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {coelsaMessages.map((msg: any, idx: number) => (
                <div
                  key={idx}
                  className="border-b border-border px-6 py-4 last:border-0"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        msg.direction === 'OUT'
                          ? 'bg-blue-50 text-primary'
                          : 'bg-green-50 text-success'
                      }`}
                    >
                      {msg.direction === 'OUT' ? 'Enviado' : 'Recibido'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateAR(msg.timestamp ?? msg.created_at)}
                    </span>
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
                    {JSON.stringify(msg.payload ?? msg, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScanLine,
  CreditCard,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import {
  useScanQR,
  useWalletPay,
  useWalletTransactions,
} from '@/hooks/useWallet'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatMoney, formatDateAR, formatCuit, txStatusColor } from '@/lib/utils'
import type { Column } from '@/components/ui/DataTable'
import type { Transaction, ParsedQRInfo } from '@/types'

type Step = 'scan' | 'confirm' | 'result'

export default function WalletPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('scan')
  const [qrData, setQrData] = useState('')
  const [parsedQR, setParsedQR] = useState<ParsedQRInfo | null>(null)
  const [amount, setAmount] = useState('')
  const [buyerCbu, setBuyerCbu] = useState('')
  const [buyerCuit, setBuyerCuit] = useState('')
  const [description, setDescription] = useState('')
  const [resultTxId, setResultTxId] = useState<string | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const scanMutation = useScanQR()
  const payMutation = useWalletPay()
  const { data: txData, isLoading: txLoading } = useWalletTransactions({
    page,
    limit: 10,
  })

  function handleScan() {
    if (!qrData.trim()) return
    scanMutation.mutate(qrData.trim(), {
      onSuccess: (data) => {
        setParsedQR(data)
        if (data.amount) setAmount(data.amount.toString())
        setStep('confirm')
      },
    })
  }

  function handlePay() {
    if (!parsedQR) return
    const payAmount = parsedQR.pointOfInitiation === 'DYNAMIC' && parsedQR.amount
      ? undefined
      : parseFloat(amount)

    if (!payAmount && parsedQR.pointOfInitiation === 'STATIC') return

    payMutation.mutate(
      {
        qr_data: qrData.trim(),
        amount: payAmount,
        buyer_cbu: buyerCbu,
        buyer_cuit: buyerCuit,
        description: description || undefined,
      },
      {
        onSuccess: (data) => {
          setResultTxId(data.transactionId)
          setResultError(null)
          setStep('result')
        },
        onError: (err) => {
          setResultError(err.message)
          setResultTxId(null)
          setStep('result')
        },
      },
    )
  }

  function handleReset() {
    setStep('scan')
    setQrData('')
    setParsedQR(null)
    setAmount('')
    setBuyerCbu('')
    setBuyerCuit('')
    setDescription('')
    setResultTxId(null)
    setResultError(null)
  }

  const columns: Column<Transaction>[] = [
    {
      key: 'qrIdTrx',
      header: 'ID',
      render: (row) => (
        <span className="font-mono text-xs text-card-foreground">
          {row.qrIdTrx.substring(0, 8)}...
        </span>
      ),
    },
    {
      key: 'merchantName',
      header: 'Comercio Destino',
      render: (row) => (
        <span className="text-sm font-medium text-card-foreground">
          {row.externalMerchantName ?? row.merchantName}
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
      <h1 className="text-2xl font-bold text-foreground">Billetera</h1>

      {/* Payment flow */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Step indicators */}
        <div className="mb-6 flex items-center gap-4">
          {(['scan', 'confirm', 'result'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm ${
                  step === s
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {s === 'scan' ? 'Escanear' : s === 'confirm' ? 'Confirmar' : 'Resultado'}
              </span>
              {i < 2 && (
                <div className="mx-2 h-px w-8 bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Scan */}
        {step === 'scan' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground">
              Escanear QR
            </h2>
            <textarea
              value={qrData}
              onChange={(e) => setQrData(e.target.value)}
              placeholder="Pegue aqui el contenido del QR escaneado..."
              rows={4}
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <button
              onClick={handleScan}
              disabled={scanMutation.isPending || !qrData.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              Escanear
            </button>
            {scanMutation.isError && (
              <p className="text-sm text-destructive">
                Error: {scanMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && parsedQR && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground">
              Confirmar Pago
            </h2>

            {/* Merchant info card */}
            <div className="rounded-md border border-border bg-muted/50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Comercio
                  </p>
                  <p className="text-sm font-medium text-card-foreground">
                    {parsedQR.merchantName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    CUIT
                  </p>
                  <p className="text-sm text-card-foreground">
                    {formatCuit(parsedQR.merchantCuit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    MCC
                  </p>
                  <p className="text-sm text-card-foreground">{parsedQR.mcc}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Tipo QR
                  </p>
                  <p className="text-sm text-card-foreground">
                    {parsedQR.pointOfInitiation === 'DYNAMIC'
                      ? 'Dinamico'
                      : 'Estatico'}
                  </p>
                </div>
                {parsedQR.amount && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Monto (del QR)
                    </p>
                    <p className="text-sm font-medium text-card-foreground">
                      {formatMoney(parsedQR.amount)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment inputs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {parsedQR.pointOfInitiation === 'STATIC' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Monto a pagar
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  CBU del pagador
                </label>
                <input
                  type="text"
                  value={buyerCbu}
                  onChange={(e) => setBuyerCbu(e.target.value)}
                  placeholder="22 caracteres"
                  maxLength={22}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  CUIT del pagador
                </label>
                <input
                  type="text"
                  value={buyerCuit}
                  onChange={(e) => setBuyerCuit(e.target.value)}
                  placeholder="11 digitos"
                  maxLength={11}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Descripcion (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripcion del pago"
                  maxLength={200}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('scan')}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Volver
              </button>
              <button
                onClick={handlePay}
                disabled={
                  payMutation.isPending ||
                  buyerCbu.length !== 22 ||
                  buyerCuit.length !== 11 ||
                  (parsedQR.pointOfInitiation === 'STATIC' && !amount)
                }
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {payMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Pagar
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && (
          <div className="space-y-4">
            {resultTxId ? (
              <div className="rounded-md border border-success/30 bg-green-50 p-6 text-center">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-success" />
                <h2 className="text-lg font-semibold text-card-foreground">
                  Pago Iniciado
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  La transaccion fue enviada a Coelsa exitosamente.
                </p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  ID: {resultTxId}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-red-50 p-6 text-center">
                <XCircle className="mx-auto mb-3 h-12 w-12 text-destructive" />
                <h2 className="text-lg font-semibold text-card-foreground">
                  Error en el Pago
                </h2>
                <p className="mt-1 text-sm text-destructive">
                  {resultError ?? 'Error desconocido'}
                </p>
              </div>
            )}
            <button
              onClick={handleReset}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Nuevo Pago
            </button>
          </div>
        )}
      </div>

      {/* Recent outbound transactions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Pagos Recientes
        </h2>
        {txLoading ? (
          <LoadingSpinner className="py-8" label="Cargando pagos..." />
        ) : (
          <DataTable
            columns={columns}
            data={txData?.data ?? []}
            onRowClick={(row) => navigate(`/transactions/${row.id}`)}
            rowKey={(row) => row.id}
            page={page}
            totalPages={txData?.totalPages ?? 1}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, QrCode, Download, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useMerchantsList } from '@/hooks/useMerchants'
import { createStaticQr, createDynamicQr, getQrImage } from '@/services/qr.service'
import { formatMoney } from '@/lib/utils'
import type { QrCode as QrCodeType } from '@/types'

export default function QrGeneratePage() {
  const navigate = useNavigate()

  const [merchantId, setMerchantId] = useState('')
  const [type, setType] = useState<'STATIC' | 'DYNAMIC'>('STATIC')
  const [amount, setAmount] = useState('')
  const [alias, setAlias] = useState('')
  const [description, setDescription] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState('30')
  const [generatedQr, setGeneratedQr] = useState<QrCodeType | null>(null)

  const { data: merchantsData } = useMerchantsList({ limit: 100 })
  const merchants = merchantsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      if (type === 'STATIC') {
        return createStaticQr({ merchantId, alias, description: description || undefined })
      }
      return createDynamicQr({
        merchantId,
        alias,
        amount: parseFloat(amount),
        description: description || undefined,
        expiresInMinutes: parseInt(expiresInMinutes) || undefined,
      })
    },
    onSuccess: (data) => {
      setGeneratedQr(data)
    },
  })

  async function handleDownload(format: 'png' | 'svg') {
    if (!generatedQr) return
    const blob = await getQrImage(generatedQr.id, format)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${generatedQr.alias || generatedQr.id}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/qr')}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">Generar Codigo QR</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">
              Configuracion
            </h2>

            <div className="space-y-4">
              {/* Merchant */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Comercio <span className="text-destructive">*</span>
                </label>
                <select
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Seleccionar comercio...</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Tipo
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setType('STATIC')}
                    className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      type === 'STATIC'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Estatico
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('DYNAMIC')}
                    className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      type === 'DYNAMIC'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Dinamico
                  </button>
                </div>
              </div>

              {/* Alias */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Alias / Etiqueta <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  required
                  placeholder="ej. Caja 1, Mostrador, Terminal A"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>

              {/* Amount (dynamic only) */}
              {type === 'DYNAMIC' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                    Monto (ARS) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required={type === 'DYNAMIC'}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              )}

              {/* Expiration (dynamic only) */}
              {type === 'DYNAMIC' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                    Expira en (minutos)
                  </label>
                  <input
                    type="number"
                    value={expiresInMinutes}
                    onChange={(e) => setExpiresInMinutes(e.target.value)}
                    min="1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Descripcion
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Descripcion opcional..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/qr')}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Generar QR
              </button>
            </div>
          </div>
        </form>

        {/* QR Preview */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Vista Previa
          </h2>

          <div className="flex flex-col items-center">
            {generatedQr ? (
              <>
                {/* QR placeholder */}
                <div className="flex h-64 w-64 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                  <QrCode className="h-32 w-32 text-primary" />
                </div>
                <p className="mt-3 text-sm font-medium text-card-foreground">
                  {generatedQr.alias || 'QR Generado'}
                </p>
                {generatedQr.amount != null && (
                  <p className="text-sm text-muted-foreground">
                    Monto: {formatMoney(generatedQr.amount)}
                  </p>
                )}

                {/* Download buttons */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => handleDownload('png')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    PNG
                  </button>
                  <button
                    onClick={() => handleDownload('svg')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    SVG
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
                <div className="text-center">
                  <QrCode className="mx-auto h-16 w-16 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Configure y genere el QR
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  Activity,
  Server,
  Wifi,
  WifiOff,
  Clock,
  Settings,
  FlaskConical,
  Save,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { healthCheck, coelsaStatus, getConfig, updateConfig } from '@/services/system.service'
import StatsCard from '@/components/ui/StatsCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const mockSandboxScenarios = [
  { id: 'happy', name: 'Happy Path', description: 'Transaccion exitosa' },
  { id: 'timeout', name: 'Timeout', description: 'COELSA no responde' },
  {
    id: 'reversal',
    name: 'Reversal',
    description: 'Transaccion reversada por COELSA',
  },
  {
    id: 'insufficient-funds',
    name: 'Fondos Insuficientes',
    description: 'Rechazo por fondos insuficientes',
  },
]

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

export default function SystemPage() {
  const queryClient = useQueryClient()
  const [selectedScenario, setSelectedScenario] = useState('happy')
  const [sandboxDelay, setSandboxDelay] = useState('200')
  const [editingConfig, setEditingConfig] = useState<Record<string, string>>({})

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: healthCheck,
    refetchInterval: 30_000,
  })

  const { data: coelsa, isLoading: coelsaLoading } = useQuery({
    queryKey: ['system', 'coelsa'],
    queryFn: coelsaStatus,
    refetchInterval: 15_000,
  })

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: getConfig,
  })

  const configMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'config'] })
    },
  })

  const configItems = config ?? []
  const isSandbox =
    configItems.find((c) => c.key === 'COELSA_MODE')?.value === 'sandbox'

  function handleConfigChange(key: string, value: string) {
    setEditingConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleSaveConfig() {
    Object.entries(editingConfig).forEach(([key, value]) => {
      configMutation.mutate({ key, value })
    })
    setEditingConfig({})
  }

  function handleSaveSandbox() {
    alert(`Sandbox: escenario=${selectedScenario}, delay=${sandboxDelay}ms`)
  }

  if (healthLoading && coelsaLoading && configLoading) {
    return <LoadingSpinner className="py-12" label="Cargando sistema..." />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Sistema</h1>

      {/* Health Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          icon={Activity}
          label="Estado"
          value={health?.status === 'healthy' || health?.status === 'ok' ? 'Saludable' : 'Con problemas'}
          changeType={health?.status === 'healthy' || health?.status === 'ok' ? 'positive' : 'negative'}
        />
        <StatsCard
          icon={Clock}
          label="Uptime"
          value={formatUptime(health?.uptime ?? 0)}
        />
        <StatsCard
          icon={Server}
          label="Version"
          value={health?.version ?? '-'}
        />
        <StatsCard
          icon={coelsa?.connected ? Wifi : WifiOff}
          label="Latencia COELSA"
          value={`${coelsa?.latencyMs ?? 0}ms`}
          change={coelsa?.connected ? 'Conectado' : 'Desconectado'}
          changeType={coelsa?.connected ? 'positive' : 'negative'}
        />
      </div>

      {/* COELSA Connection */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-card-foreground">
          <Wifi className="h-5 w-5" />
          Estado de Conexion COELSA
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Estado
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  coelsa?.connected ? 'bg-success' : 'bg-error'
                }`}
              />
              <span className="text-sm text-card-foreground">
                {coelsa?.connected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Ultimo Ping
            </p>
            <p className="mt-1 text-sm text-card-foreground">
              {coelsa?.lastPing
                ? new Date(coelsa.lastPing).toLocaleString('es-AR')
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Latencia
            </p>
            <p className="mt-1 text-sm text-card-foreground">
              {coelsa?.latencyMs ?? 0}ms
            </p>
          </div>
        </div>
      </div>

      {/* System Config */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
            <Settings className="h-5 w-5" />
            Configuracion del Sistema
          </h2>
          {Object.keys(editingConfig).length > 0 && (
            <button
              onClick={handleSaveConfig}
              disabled={configMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
          )}
        </div>

        {configLoading ? (
          <LoadingSpinner className="py-6" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Clave
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Valor
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Descripcion
                  </th>
                </tr>
              </thead>
              <tbody>
                {configItems.map((cfg) => (
                  <tr key={cfg.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-card-foreground">
                      {cfg.key}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editingConfig[cfg.key] ?? cfg.value}
                        onChange={(e) =>
                          handleConfigChange(cfg.key, e.target.value)
                        }
                        className="w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {cfg.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sandbox Config */}
      {isSandbox && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <FlaskConical className="h-5 w-5 text-warning" />
              Configuracion Sandbox
            </h2>
            <span className="inline-flex items-center rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning">
              SANDBOX
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                Escenario
              </label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {mockSandboxScenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name} - {sc.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                Delay (ms)
              </label>
              <input
                type="number"
                value={sandboxDelay}
                onChange={(e) => setSandboxDelay(e.target.value)}
                min="0"
                max="30000"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleSaveSandbox}
              className="inline-flex items-center gap-1.5 rounded-md bg-warning px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-warning/90"
            >
              <Save className="h-4 w-4" />
              Aplicar Configuracion Sandbox
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

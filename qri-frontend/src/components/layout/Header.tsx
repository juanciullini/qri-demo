import { useAuthStore } from '@/stores/auth.store'
import { LogOut } from 'lucide-react'

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  OPERATOR: 'bg-blue-100 text-blue-700',
  MERCHANT: 'bg-green-100 text-green-700',
  VIEWER: 'bg-gray-100 text-gray-700',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  MERCHANT: 'Comercio',
  VIEWER: 'Visualizador',
}

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div>
        {/* Page title will be managed by each page; this is a placeholder */}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-card-foreground">
                {user.name}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  roleBadgeColors[user.role] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {roleLabels[user.role] ?? user.role}
              </span>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </>
        )}
      </div>
    </header>
  )
}

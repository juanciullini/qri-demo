import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import {
  LayoutDashboard,
  Store,
  QrCode,
  ArrowLeftRight,
  Wallet,
  Receipt,
  Percent,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import type { User } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: User['role'][]
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'OPERATOR', 'MERCHANT', 'VIEWER'],
  },
  {
    to: '/merchants',
    label: 'Comercios',
    icon: Store,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    to: '/qr',
    label: 'Codigos QR',
    icon: QrCode,
    roles: ['ADMIN', 'OPERATOR', 'MERCHANT'],
  },
  {
    to: '/wallet',
    label: 'Billetera',
    icon: Wallet,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    to: '/transactions',
    label: 'Transacciones',
    icon: ArrowLeftRight,
    roles: ['ADMIN', 'OPERATOR', 'MERCHANT', 'VIEWER'],
  },
  {
    to: '/settlements',
    label: 'Liquidaciones',
    icon: Receipt,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    to: '/commissions',
    label: 'Comisiones',
    icon: Percent,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    to: '/users',
    label: 'Usuarios',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    to: '/system',
    label: 'Sistema',
    icon: Settings,
    roles: ['ADMIN'],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const userRole = user?.role ?? 'VIEWER'

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole),
  )

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <span className="text-xl font-bold text-primary">QRI</span>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground hover:bg-muted',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <p className="text-xs text-muted-foreground">QRI Admin Panel</p>
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
      )}
    </aside>
  )
}

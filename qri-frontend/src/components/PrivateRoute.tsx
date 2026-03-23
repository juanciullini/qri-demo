import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { User } from '@/types'

interface PrivateRouteProps {
  children: React.ReactNode
  roles?: User['role'][]
}

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const user = useAuthStore((s) => s.user)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={40} label="Cargando..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

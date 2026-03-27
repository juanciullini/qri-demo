import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import PrivateRoute from '@/components/PrivateRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import MerchantsListPage from '@/pages/merchants/MerchantsListPage'
import MerchantDetailPage from '@/pages/merchants/MerchantDetailPage'
import MerchantFormPage from '@/pages/merchants/MerchantFormPage'
import QrListPage from '@/pages/qr/QrListPage'
import QrGeneratePage from '@/pages/qr/QrGeneratePage'
import WalletPage from '@/pages/wallet/WalletPage'
import TransactionsPage from '@/pages/transactions/TransactionsPage'
import TransactionDetailPage from '@/pages/transactions/TransactionDetailPage'
import SettlementsPage from '@/pages/settlements/SettlementsPage'
import SettlementDetailPage from '@/pages/settlements/SettlementDetailPage'
import CommissionsPage from '@/pages/commissions/CommissionsPage'
import CommissionProfilesPage from '@/pages/commissions/CommissionProfilesPage'
import UsersPage from '@/pages/UsersPage'
import SystemPage from '@/pages/SystemPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <AuthInitializer>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Private */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <AppLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<DashboardPage />} />

              {/* Merchants */}
              <Route
                path="merchants"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <MerchantsListPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="merchants/new"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <MerchantFormPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="merchants/:id"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <MerchantDetailPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="merchants/:id/edit"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <MerchantFormPage />
                  </PrivateRoute>
                }
              />

              {/* QR Codes */}
              <Route
                path="qr"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR', 'MERCHANT']}>
                    <QrListPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="qr/generate"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR', 'MERCHANT']}>
                    <QrGeneratePage />
                  </PrivateRoute>
                }
              />

              {/* Wallet */}
              <Route
                path="wallet"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <WalletPage />
                  </PrivateRoute>
                }
              />

              {/* Transactions */}
              <Route path="transactions" element={<TransactionsPage />} />
              <Route
                path="transactions/:id"
                element={<TransactionDetailPage />}
              />

              {/* Settlements */}
              <Route
                path="settlements"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <SettlementsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="settlements/:id"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <SettlementDetailPage />
                  </PrivateRoute>
                }
              />

              {/* Commissions */}
              <Route
                path="commissions"
                element={
                  <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
                    <CommissionsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="commissions/profiles"
                element={
                  <PrivateRoute roles={['ADMIN']}>
                    <CommissionProfilesPage />
                  </PrivateRoute>
                }
              />

              {/* Users - ADMIN only */}
              <Route
                path="users"
                element={
                  <PrivateRoute roles={['ADMIN']}>
                    <UsersPage />
                  </PrivateRoute>
                }
              />

              {/* System - ADMIN only */}
              <Route
                path="system"
                element={
                  <PrivateRoute roles={['ADMIN']}>
                    <SystemPage />
                  </PrivateRoute>
                }
              />
            </Route>
          </Routes>
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

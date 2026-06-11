import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { SidebarProvider } from './context/SidebarContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import AdmitPatient from './pages/AdmitPatient'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Outpatient from './pages/Outpatient'
import Sidebar from './components/Sidebar'
import TabNavigation from './components/TabNavigation'

function ProtectedLayout({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-gray-6 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-ios-blue flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <p className="text-ios-gray-1 text-sm font-medium">Loading WardRounds…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-ios-gray-6 dark:bg-gray-900 p-3 gap-3">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden rounded-3xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm">
          <div className="flex-1 overflow-y-auto scrollbar-none pb-36 md:pb-0">
            {children}
          </div>
          <TabNavigation />
        </main>
      </div>
    </SidebarProvider>
  )
}

function PublicRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/patients" element={<ProtectedLayout><Patients /></ProtectedLayout>} />
        <Route path="/admit" element={<ProtectedLayout><AdmitPatient /></ProtectedLayout>} />
        <Route path="/outpatient" element={<ProtectedLayout><Outpatient /></ProtectedLayout>} />
        <Route path="/analytics" element={<ProtectedLayout><Analytics /></ProtectedLayout>} />
        <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

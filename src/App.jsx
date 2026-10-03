import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { SidebarProvider } from './context/SidebarContext'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import { OPEN_SETUP_EVENT } from './lib/onboarding'
import Sidebar from './components/Sidebar'
import PageGuard from './components/PageGuard'
import TabNavigation from './components/TabNavigation'
import SessionGuard from './components/SessionGuard'
import InstallModal from './components/pwa/InstallModal'
import InstallBanner from './components/pwa/InstallBanner'

// Route-level code splitting: each page ships as its own chunk, fetched on
// first visit instead of all being bundled into one ~1.8MB upfront payload.
// Structural pieces used on every route (Sidebar, PageGuard, TabNavigation,
// SessionGuard above) stay eager since splitting them out wouldn't reduce
// what's needed for first paint.
const Login          = lazy(() => import('./pages/Login'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Patients       = lazy(() => import('./pages/Patients'))
const AdmitPatient   = lazy(() => import('./pages/AdmitPatient'))
const Analytics      = lazy(() => import('./pages/Analytics'))
const Settings       = lazy(() => import('./pages/Settings'))
const Outpatient     = lazy(() => import('./pages/Outpatient'))
const Billing        = lazy(() => import('./pages/Billing'))
const Shifts         = lazy(() => import('./pages/Shifts'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const AuthCallback   = lazy(() => import('./pages/AuthCallback'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Landing        = lazy(() => import('./pages/landing/Landing'))
const MobileLanding  = lazy(() => import('./pages/landing/MobileLanding'))
const Privacy        = lazy(() => import('./pages/legal/Privacy'))

// Decided once at load: touch / coarse-pointer devices (phones, tablets) get the
// lightweight MobileLanding; desktop keeps the animated Landing. Branching here
// means mobile never even downloads the heavy Landing chunk (framer-motion +
// Lenis + showcase mocks). `?mobile=1` forces MobileLanding on desktop for review.
const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' &&
  (window.matchMedia('(hover: none), (pointer: coarse)').matches ||
    new URLSearchParams(window.location.search).has('mobile'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ios-gray-6 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <img src="/wardrounds-icon.png" className="w-12 h-12 object-contain animate-pulse" alt="WardRounds" />
        <p className="text-ios-gray-1 text-sm font-medium">Loading WardRounds…</p>
      </div>
    </div>
  )
}

function ProtectedLayout({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-gray-6 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <img src="/wardrounds-icon.png" className="w-12 h-12 object-contain animate-pulse" alt="WardRounds" />
          <p className="text-ios-gray-1 text-sm font-medium">Loading WardRounds…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <SidebarProvider>
      <div className="flex h-dvh overflow-hidden bg-ios-gray-6 dark:bg-gray-900 p-3 gap-3">
        <Sidebar />
        <main className="relative flex-1 flex flex-col overflow-hidden rounded-3xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm">
          <div id="main-scroll" className="flex-1 overflow-y-auto scrollbar-none pb-24 sm:pb-0">
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

function RootRoute() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return IS_TOUCH_DEVICE ? <MobileLanding /> : <Landing />
  return <ProtectedLayout><DefaultRedirect /></ProtectedLayout>
}

function DefaultRedirect() {
  const { permissions, modules } = useAuth()
  if (!permissions) return null
  // Users whose pay types don't include ward rounds land on their own module first.
  if (modules && !modules.inpatient) {
    if (modules.outpatient && permissions.view_outpatient === true) return <Navigate to="/outpatient" replace />
    if (modules.shifts && permissions.view_shifts === true) return <Navigate to="/shifts" replace />
  }
  if (permissions?.view_inpatient === true) return <Dashboard />
  if (permissions?.view_outpatient === true) return <Navigate to="/outpatient" replace />
  if (permissions?.view_patients === true) return <Navigate to="/patients" replace />
  if (permissions?.view_billing === true) return <Navigate to="/billing" replace />
  if (permissions?.view_shifts === true) return <Navigate to="/shifts" replace />
  if (permissions?.view_analytics === true) return <Navigate to="/analytics" replace />
  return <Navigate to="/settings" replace />
}

function AppInner() {
  const { user, session, refreshUser } = useAuth()
  const navigate = useNavigate()
  // Setup wizard: shown automatically until the user has completed it
  // (users.onboarded_at is NULL — brand-new signups and newly invited members),
  // and on demand from Settings (OPEN_SETUP_EVENT) or with ?setup=1.
  // `undefined` onboarded_at (column not migrated yet) never forces it.
  const [setupRequested, setSetupRequested] = useState(() => new URLSearchParams(window.location.search).get('setup') === '1')
  const needsSetup = !!user?.team_id && user?.onboarded_at === null
  const showWizard = !!user?.team_id && (needsSetup || setupRequested)

  useEffect(() => {
    const open = () => setSetupRequested(true)
    window.addEventListener(OPEN_SETUP_EVENT, open)
    return () => window.removeEventListener(OPEN_SETUP_EVENT, open)
  }, [])

  async function handleSetupDone(route) {
    setSetupRequested(false)
    await refreshUser()
    navigate(route, { replace: true })
  }

  const routes = (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<RootRoute />} />
        <Route path="/patients" element={<ProtectedLayout><PageGuard permKey="view_patients"><Patients /></PageGuard></ProtectedLayout>} />
        <Route path="/admit" element={<ProtectedLayout><PageGuard permKey="view_admit"><AdmitPatient /></PageGuard></ProtectedLayout>} />
        <Route path="/outpatient" element={<ProtectedLayout><PageGuard permKey="view_outpatient"><Outpatient /></PageGuard></ProtectedLayout>} />
        <Route path="/appointments" element={<ProtectedLayout><PageGuard permKey="view_appointments"><MyAppointments /></PageGuard></ProtectedLayout>} />
        <Route path="/billing" element={<ProtectedLayout><PageGuard permKey="view_billing"><Billing /></PageGuard></ProtectedLayout>} />
        <Route path="/shifts" element={<ProtectedLayout><PageGuard permKey="view_shifts"><Shifts /></PageGuard></ProtectedLayout>} />
        <Route path="/analytics" element={<ProtectedLayout><PageGuard permKey="view_analytics"><Analytics /></PageGuard></ProtectedLayout>} />
        <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
        {/* Public + ungated on purpose: Meta requires a publicly fetchable
            Privacy Policy URL to publish the app, and patients receiving
            WhatsApp reminders must be able to read it without an account. */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )

  const modals = (
    <>
      {showWizard && (
        <OnboardingWizard
          key={user.id}
          user={user}
          onDone={handleSetupDone}
          onClose={needsSetup ? null : () => setSetupRequested(false)}
        />
      )}
      {/* Install confirm/steps modal — app-wide (opened from the banner or the
          Sidebar "Install App" row). Self-hides when not installable. */}
      <InstallModal />
    </>
  )

  if (session) {
    return (
      <SessionGuard>
        {routes}
        {modals}
      </SessionGuard>
    )
  }

  return (
    <>
      <InstallBanner />
      {routes}
      {modals}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}

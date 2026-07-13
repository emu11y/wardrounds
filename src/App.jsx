import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import { SidebarProvider } from './context/SidebarContext'
import WelcomeModal from './components/onboarding/WelcomeModal'
import TooltipTour from './components/onboarding/TooltipTour'
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
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const AuthCallback   = lazy(() => import('./pages/AuthCallback'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Landing        = lazy(() => import('./pages/landing/Landing'))
const MobileLanding  = lazy(() => import('./pages/landing/MobileLanding'))

// Decided once at load: touch / coarse-pointer devices (phones, tablets) get the
// lightweight static MobileLanding; desktop keeps the animated Landing. Branching
// here means mobile never even downloads the heavy Landing chunk (framer-motion +
// Lenis + showcase mocks).
const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: none), (pointer: coarse)').matches

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
      {/* Solid white backing behind the iOS status bar so the top reads clean
          (matching the white header) instead of the shell's grey showing through
          in standalone. Height is env(safe-area-inset-top) — 0 in a normal
          browser tab, so this is a no-op there. z-index sits below the sidebar,
          overlay (z-40) and header (z-61) so it never covers them. */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 inset-x-0 z-[35] bg-white"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />
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
  const { permissions } = useAuth()
  if (!permissions) return null
  if (permissions?.view_inpatient === true) return <Dashboard />
  if (permissions?.view_outpatient === true) return <Navigate to="/outpatient" replace />
  if (permissions?.view_patients === true) return <Navigate to="/patients" replace />
  if (permissions?.view_analytics === true) return <Navigate to="/analytics" replace />
  return <Navigate to="/settings" replace />
}

const ONBOARDING_KEY = 'wr_onboarding_complete'

function AppInner() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(false)
  const [showTour, setShowTour]       = useState(false)

  useEffect(() => {
    if (!user || !user.team_id) return

    const forceShow = new URLSearchParams(window.location.search).get('onboarding')
    if (forceShow === '1') {
      localStorage.removeItem(ONBOARDING_KEY)
      setShowWelcome(true)
      return
    }

    if (localStorage.getItem(ONBOARDING_KEY)) return
    supabase
      .from('hospitals')
      .select('id')
      .eq('team_id', user.team_id)
      .limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) setShowWelcome(true)
      })
  }, [user])

  function handleOnboardingStart() {
    setShowWelcome(false)
    setShowTour(true)
  }

  function handleOnboardingComplete() {
    setShowTour(false)
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }

  function handleOnboardingSkip() {
    setShowWelcome(false)
    setShowTour(false)
    localStorage.setItem(ONBOARDING_KEY, 'true')
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
        <Route path="/analytics" element={<ProtectedLayout><PageGuard permKey="view_analytics"><Analytics /></PageGuard></ProtectedLayout>} />
        <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )

  const modals = (
    <>
      {showWelcome && (
        <WelcomeModal
          userName={user?.full_name}
          onStart={handleOnboardingStart}
          onSkip={handleOnboardingSkip}
        />
      )}
      {showTour && (
        <TooltipTour onComplete={handleOnboardingComplete} />
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

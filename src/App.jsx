import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { PermissionProvider } from '@/lib/PermissionContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { Navigate } from 'react-router-dom';

// Everything behind the auth gate is lazy — none of it can render before
// ProtectedRoute resolves anyway, so splitting it out of the main chunk is
// free: it shrinks the bundle every visitor downloads (including the ~half
// who only ever see /login) without changing when any of these screens
// actually appear on screen. The four public auth pages above stay eager —
// they're on the very first paint for a signed-out visitor.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Scan = lazy(() => import('@/pages/Scan'));
const Groups = lazy(() => import('@/pages/Groups'));
const Children = lazy(() => import('@/pages/Children'));
const ChildDetail = lazy(() => import('@/pages/ChildDetail'));
const BadgePrint = lazy(() => import('@/pages/BadgePrint'));
const Reports = lazy(() => import('@/pages/Reports'));
const Parishes = lazy(() => import('@/pages/Parishes'));
const Users = lazy(() => import('@/pages/Users'));
const Premium = lazy(() => import('@/pages/Premium'));
const Permissions = lazy(() => import('@/pages/Permissions'));
const Manual = lazy(() => import('@/pages/Manual'));
const SupportTickets = lazy(() => import('@/pages/SupportTickets'));
const About = lazy(() => import('@/pages/About'));
// Add page imports here

const RouteFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/escanear" element={<Scan />} />
            <Route path="/grupos" element={<Groups />} />
            <Route path="/ninos" element={<Children />} />
            <Route path="/ninos/gafetes" element={<BadgePrint />} />
            <Route path="/ninos/:id" element={<ChildDetail />} />
            <Route path="/reportes" element={<Reports />} />
            <Route path="/parroquia" element={<Parishes />} />
            <Route path="/usuarios" element={<Users />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/permisos" element={<Permissions />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/soporte" element={<SupportTickets />} />
            <Route path="/acerca-de" element={<About />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <ScrollToTop />
              <AuthenticatedApp />
            </Router>
            <Toaster />
            <ThemeSwitcher />
          </QueryClientProvider>
        </PermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const AiNurturePage = lazy(() =>
  import('../features/ai-nurture/AiNurturePage')
)

const CollectionsPage = lazy(() =>
  import('../features/collections/CollectionsWorkspace')
    .then(module => ({ default: module.CollectionsPage }))
);

const CollectionsLoginPage = lazy(() =>
  import('../features/collections/CollectionsWorkspace')
    .then(module => ({ default: module.CollectionsLoginPage }))
);

const AcademyEmbedPage = lazy(() =>
  import('../features/academy/AcademyEmbedPage')
);

const AdminLoginPage = lazy(() => import('../features/admin/AdminLoginPage'))
const AdminOverviewPage = lazy(() => import('../features/admin/AdminOverviewPage'))
const WorkspaceRoute = lazy(() => import('./WorkspaceRoute'))
import LandingAuthPage from '../features/landing/LandingAuthPage'


import LegalPages from '../features/legal/LegalPages'

function FederationLegacyCheckoutRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={{
        pathname: '/federation',
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  )
}

export default function AppRouter() {
  return (
    <Suspense
      fallback={
        <main role="status" style={{ padding: 24 }}>
          Loading YH Universe...
        </main>
      }
    >
    <Routes>
      <Route
        path="/"
        element={<LandingAuthPage />}
      />

      <Route
        path="/login"
        element={
          <LandingAuthPage initialMode="login" />
        }
      />

      <Route
        path="/register"
        element={
          <LandingAuthPage initialMode="register" />
        }
      />

      <Route
        path="/forgot-password"
        element={
          <LandingAuthPage initialMode="forgot" />
        }
      />

      <Route
        path="/dashboard"
        element={<WorkspaceRoute workspaceId="dashboard" />}
      />

      <Route
        path="/academy"
        element={<WorkspaceRoute workspaceId="academy" />}
      />
      <Route
        path="/academy/:sectionId"
        element={<WorkspaceRoute workspaceId="academy" />}
      />

      <Route
        path="/plaza"
        element={<WorkspaceRoute workspaceId="plaza" />}
      />
      <Route
        path="/plaza/:sectionId"
        element={<WorkspaceRoute workspaceId="plaza" />}
      />

      <Route
        path="/federation"
        element={<WorkspaceRoute workspaceId="federation" />}
      />
      <Route
        path="/federation/:sectionId"
        element={<WorkspaceRoute workspaceId="federation" />}
      />
      <Route
        path="/federation.html"
        element={<FederationLegacyCheckoutRedirect />}
      />

      <Route
        path="/messages"
        element={<WorkspaceRoute workspaceId="messages" />}
      />

      <Route
        path="/business-chats"
        element={<WorkspaceRoute workspaceId="business-chats" />}
      />

      <Route
        path="/profile"
        element={<WorkspaceRoute workspaceId="profile" />}
      />

      <Route
        path="/wallet"
        element={<WorkspaceRoute workspaceId="wallet" />}
      />

      <Route
        path="/settings"
        element={<WorkspaceRoute workspaceId="settings" />}
      />

      <Route path="/privacy" element={<LegalPages page="privacy" />} />
      <Route path="/terms" element={<LegalPages page="terms" />} />
      <Route path="/child-safety" element={<LegalPages page="child-safety" />} />
      <Route path="/delete-account" element={<LegalPages page="delete-account" />} />
      <Route path="/collections/:loginAccessKey" element={
        <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading Collections...</div>}>
          <CollectionsPage />
        </Suspense>
      } />
      <Route path="/collections-login/:loginAccessKey" element={
        <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading Collections Login...</div>}>
          <CollectionsLoginPage />
        </Suspense>
      } />

      <Route
        path="/internal/ai-nurture.html"
        element={<Suspense fallback={null}><AiNurturePage /></Suspense>}
      />
      <Route
        path="/internal/ai-nurture"
        element={<Suspense fallback={null}><AiNurturePage /></Suspense>}
      />
      <Route path="/academy-embed" element={
        <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading Academy...</div>}>
          <AcademyEmbedPage />
        </Suspense>
      } />

      <Route
        path="/academy-embed.html"
        element={
          <Suspense fallback={null}>
            <AcademyEmbedPage />
          </Suspense>
        }
      />
      <Route path="/admin/:adminRouteKey/login" element={<AdminLoginPage />} />
      <Route path="/admin/:adminRouteKey/panel" element={<AdminOverviewPage />} />
<Route path="/admin/:adminRouteKey/panel-preview" element={<AdminOverviewPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  )
}

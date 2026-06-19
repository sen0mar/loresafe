import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RouteErrorBoundary } from "./route-error-boundary.js";
import { Sentry } from "./sentry.js";
import {
  ProtectedRoute,
  PublicOnlyRoute
} from "../features/auth/components/auth-route-guards.js";
import { LoginPage } from "../features/auth/pages/login-page.js";
import { SignupPage } from "../features/auth/pages/signup-page.js";
import { ClubDetailPage } from "../features/clubs/pages/club-detail-page.js";
import { ClubModerationReportsPage } from "../features/clubs/pages/club-moderation-reports-page.js";
import { CreateClubPage } from "../features/clubs/pages/create-club-page.js";
import { ExplorePage } from "../features/clubs/pages/explore-page.js";
import { PostDetailPage } from "../features/clubs/pages/post-detail-page.js";
import { RecentlyUnlockedPage } from "../features/clubs/pages/recently-unlocked-page.js";
import { DebugSentryErrorPage } from "../features/debug/pages/debug-sentry-error-page.js";
import { HomePage } from "../features/home/pages/home-page.js";
import { InviteAcceptPage } from "../features/invites/pages/invite-accept-page.js";
import { LandingPage } from "../features/landing/pages/landing-page.js";
import { NotificationsPage } from "../features/notifications/pages/notifications-page.js";
import { ProfileSettingsPage } from "../features/profile/pages/profile-settings-page.js";
import { SearchResultsPage } from "../features/search/pages/search-results-page.js";
import { Toaster } from "../shared/components/ui/sonner.js";
import { AUTHENTICATED_HOME_PATH } from "./routes.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);
const isDebugSentryRouteEnabled =
  import.meta.env.VITE_SENTRY_ENABLE_DEBUG_ROUTE === "true" &&
  import.meta.env.PROD !== true;

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <RouteErrorBoundary>
        <SentryRoutes>
          <Route
            path="/"
            element={<LandingPage />}
          />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/profile"
            element={
              <ProtectedRoute>
                <Navigate to={AUTHENTICATED_HOME_PATH} replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/explore"
            element={
              <ProtectedRoute>
                <ExplorePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/clubs/new"
            element={
              <ProtectedRoute>
                <CreateClubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/clubs/:slug/recently-unlocked"
            element={
              <ProtectedRoute>
                <RecentlyUnlockedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/clubs/:slug/settings/moderation"
            element={
              <ProtectedRoute>
                <ClubModerationReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/clubs/:slug"
            element={
              <ProtectedRoute>
                <ClubDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/search"
            element={
              <ProtectedRoute>
                <SearchResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/posts/:postId"
            element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invite/:token"
            element={
              <ProtectedRoute>
                <InviteAcceptPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/settings/profile"
            element={
              <ProtectedRoute>
                <ProfileSettingsPage />
              </ProtectedRoute>
            }
          />
          {isDebugSentryRouteEnabled ? (
            <Route
              path="/app/debug/sentry-error"
              element={<DebugSentryErrorPage />}
            />
          ) : null}
          <Route
            path="/app/*"
            element={
              <ProtectedRoute>
                <Navigate to={AUTHENTICATED_HOME_PATH} replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
        </SentryRoutes>
      </RouteErrorBoundary>
      <Toaster position="top-right" />
    </BrowserRouter>
  </QueryClientProvider>
);

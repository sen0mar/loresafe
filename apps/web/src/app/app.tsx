import { lazy, Suspense, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";

import { RouteErrorBoundary } from "./route-error-boundary.js";
import { Sentry } from "./sentry.js";
import {
  ProtectedRoute,
  PublicOnlyRoute
} from "../features/auth/components/auth-route-guards.js";
import { LandingPage } from "../features/landing/pages/landing-page.js";
import { PublicClubProfilePage } from "../features/public-clubs/pages/public-club-profile-page.js";
import { PublicClubsPage } from "../features/public-clubs/pages/public-clubs-page.js";
import { Toaster } from "../shared/components/ui/sonner.js";
import { RouteDocumentMetadata } from "../shared/hooks/use-document-metadata.js";
import { toPublicUrl } from "../shared/lib/public-site-origin.js";
import { AUTHENTICATED_HOME_PATH } from "./routes.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

type DebugSentryRouteEnv = {
  MODE?: string;
  PROD?: boolean;
  VITE_SENTRY_ENABLE_DEBUG_ROUTE?: string;
};

export const shouldEnableDebugSentryRoute = (clientEnv: DebugSentryRouteEnv) =>
  clientEnv.VITE_SENTRY_ENABLE_DEBUG_ROUTE === "true" &&
  clientEnv.MODE !== "test" &&
  clientEnv.PROD !== true;

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);
const isDebugSentryRouteEnabled = shouldEnableDebugSentryRoute(import.meta.env);

const ClubDetailPage = lazyRoute(
  () => import("../features/clubs/pages/club-detail-page.js"),
  "ClubDetailPage"
);
const ClubModerationReportsPage = lazyRoute(
  () => import("../features/clubs/pages/club-moderation-reports-page.js"),
  "ClubModerationReportsPage"
);
const CreateClubPage = lazyRoute(
  () => import("../features/clubs/pages/create-club-page.js"),
  "CreateClubPage"
);
const DebugSentryErrorPage = lazyRoute(
  () => import("../features/debug/pages/debug-sentry-error-page.js"),
  "DebugSentryErrorPage"
);
const ExplorePage = lazyRoute(
  () => import("../features/clubs/pages/explore-page.js"),
  "ExplorePage"
);
const HomePage = lazyRoute(
  () => import("../features/home/pages/home-page.js"),
  "HomePage"
);
const InviteAcceptPage = lazyRoute(
  () => import("../features/invites/pages/invite-accept-page.js"),
  "InviteAcceptPage"
);
const JoinedClubsPage = lazyRoute(
  () => import("../features/clubs/pages/joined-clubs-page.js"),
  "JoinedClubsPage"
);
const LoginPage = lazyRoute(
  () => import("../features/auth/pages/login-page.js"),
  "LoginPage"
);
const NotificationsPage = lazyRoute(
  () => import("../features/notifications/pages/notifications-page.js"),
  "NotificationsPage"
);
const PostDetailPage = lazyRoute(
  () => import("../features/clubs/pages/post-detail-page.js"),
  "PostDetailPage"
);
const ProfileSettingsPage = lazyRoute(
  () => import("../features/profile/pages/profile-settings-page.js"),
  "ProfileSettingsPage"
);
const RecentlyUnlockedPage = lazyRoute(
  () => import("../features/clubs/pages/recently-unlocked-page.js"),
  "RecentlyUnlockedPage"
);
const SignupPage = lazyRoute(
  () => import("../features/auth/pages/signup-page.js"),
  "SignupPage"
);

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <SentryRoutes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/clubs" element={<PublicClubsPage />} />
            <Route
              path="/clubs/:linkName"
              element={<PublicClubProfilePage />}
            />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <HomePage />
                  <NoindexRouteMetadata
                    title="Home | LoreSafe"
                    description="Your LoreSafe home for spoiler-safe clubs and conversations."
                  />
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
              path="/app/clubs"
              element={
                <ProtectedRoute>
                  <JoinedClubsPage />
                  <NoindexRouteMetadata
                    title="My clubs | LoreSafe"
                    description="Search and open the LoreSafe clubs you have joined."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/explore"
              element={
                <ProtectedRoute>
                  <ExplorePage />
                  <NoindexRouteMetadata
                    title="Explore clubs | LoreSafe"
                    description="Find public LoreSafe clubs to join."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/clubs/new"
              element={
                <ProtectedRoute>
                  <CreateClubPage />
                  <NoindexRouteMetadata
                    title="Create club | LoreSafe"
                    description="Create a LoreSafe club for spoiler-safe discussion."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/clubs/:linkName/recently-unlocked"
              element={
                <ProtectedRoute>
                  <RecentlyUnlockedPage />
                  <NoindexRouteMetadata
                    title="Recently unlocked | LoreSafe"
                    description="Review LoreSafe discussions unlocked by your latest progress."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/clubs/:linkName/settings/moderation"
              element={
                <ProtectedRoute>
                  <ClubModerationReportsPage />
                  <NoindexRouteMetadata
                    title="Moderation reports | LoreSafe"
                    description="Review spoiler and safety reports for your LoreSafe club."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/clubs/:linkName"
              element={
                <ProtectedRoute>
                  <ClubDetailPage />
                  <NoindexRouteMetadata
                    title="Club | LoreSafe"
                    description="Open your LoreSafe club dashboard, feed, progress, and settings."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                  <NoindexRouteMetadata
                    title="Notifications | LoreSafe"
                    description="Manage your spoiler-safe LoreSafe notifications."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/search"
              element={
                <ProtectedRoute>
                  <SearchRedirect />
                  <NoindexRouteMetadata
                    title="Search | LoreSafe"
                    description="Search LoreSafe clubs and spoiler-safe discussions."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/posts/:postId"
              element={
                <ProtectedRoute>
                  <PostDetailPage />
                  <NoindexRouteMetadata
                    title="Discussion | LoreSafe"
                    description="Read a LoreSafe discussion when it is safe for your progress."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invite/:token"
              element={
                <ProtectedRoute>
                  <InviteAcceptPage />
                  <NoindexRouteMetadata
                    title="Club invite | LoreSafe"
                    description="Accept a private LoreSafe club invitation."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/settings/profile"
              element={
                <ProtectedRoute>
                  <ProfileSettingsPage />
                  <NoindexRouteMetadata
                    title="Profile settings | LoreSafe"
                    description="Update your LoreSafe profile and account settings."
                  />
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
                  <NoindexRouteMetadata
                    title="Home | LoreSafe"
                    description="Your LoreSafe home for spoiler-safe clubs and conversations."
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                  <NoindexRouteMetadata
                    title="Log in | LoreSafe"
                    description="Log in to LoreSafe to continue spoiler-safe club discussions."
                  />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <SignupPage />
                  <NoindexRouteMetadata
                    title="Sign up | LoreSafe"
                    description="Create a LoreSafe account for spoiler-safe story clubs."
                  />
                </PublicOnlyRoute>
              }
            />
          </SentryRoutes>
        </Suspense>
      </RouteErrorBoundary>
      <Toaster position="top-right" />
    </BrowserRouter>
  </QueryClientProvider>
);

const SearchRedirect = () => {
  const location = useLocation();

  return <Navigate to={`/app/explore${location.search}`} replace />;
};

const NoindexRouteMetadata = ({
  title,
  description
}: {
  title: string;
  description: string;
}) => {
  const location = useLocation();

  return (
    <RouteDocumentMetadata
      title={title}
      description={description}
      canonicalPath={toPublicUrl(location.pathname)}
      robots="noindex, nofollow"
    />
  );
};

const RouteFallback = () => (
  <div className="min-h-screen bg-background text-primary" aria-live="polite">
    <span className="sr-only">Loading route</span>
  </div>
);

function lazyRoute<
  TModule extends Record<string, unknown>,
  TKey extends keyof TModule
>(importer: () => Promise<TModule>, exportName: TKey) {
  return lazy(async () => {
    const module = await importer();

    return {
      default: module[exportName] as ComponentType
    };
  });
}

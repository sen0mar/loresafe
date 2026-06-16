import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import {
  ProtectedRoute,
  PublicOnlyRoute
} from "../features/auth/components/auth-route-guards.js";
import { LoginPage } from "../features/auth/pages/login-page.js";
import { SignupPage } from "../features/auth/pages/signup-page.js";
import { ClubDetailPage } from "../features/clubs/pages/club-detail-page.js";
import { CreateClubPage } from "../features/clubs/pages/create-club-page.js";
import { ExplorePage } from "../features/clubs/pages/explore-page.js";
import { PostDetailPage } from "../features/clubs/pages/post-detail-page.js";
import { RecentlyUnlockedPage } from "../features/clubs/pages/recently-unlocked-page.js";
import { HomePage } from "../features/health/pages/home-page.js";
import { InviteAcceptPage } from "../features/invites/pages/invite-accept-page.js";
import { ProfileSettingsPage } from "../features/profile/pages/profile-settings-page.js";
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

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Navigate to={AUTHENTICATED_HOME_PATH} replace />
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
          path="/app/clubs/:slug"
          element={
            <ProtectedRoute>
              <ClubDetailPage />
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
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  </QueryClientProvider>
);

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import {
  ProtectedRoute,
  PublicOnlyRoute
} from "../features/auth/components/auth-route-guards.js";
import { LoginPage } from "../features/auth/pages/login-page.js";
import { SignupPage } from "../features/auth/pages/signup-page.js";
import { HomePage } from "../features/health/pages/home-page.js";
import { ProfilePage } from "../features/profile/pages/profile-page.js";
import { Toaster } from "../shared/components/ui/sonner.js";

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
              <Navigate to="/app/profile" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <Navigate to="/app/profile" replace />
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

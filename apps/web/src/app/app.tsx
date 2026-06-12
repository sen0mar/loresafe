import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/pages/login-page.js";
import { SignupPage } from "../features/auth/pages/signup-page.js";
import { HomePage } from "../features/health/pages/home-page.js";
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
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  </QueryClientProvider>
);

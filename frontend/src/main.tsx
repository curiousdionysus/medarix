import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/features/theme/theme-context";
import { LocaleProvider } from "@/features/i18n/locale-context";
import { BrandingProvider } from "@/features/branding/branding-context";
import { AuthProvider } from "@/features/auth/auth-context";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <BrandingProvider>
              <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
              </BrowserRouter>
            </BrandingProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

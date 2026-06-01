import { Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute, RoleGuard, EnterpriseGuard } from "@/components/layout/protected-route";
import LoginPage from "@/pages/login";
import DictationPage from "@/pages/workspace/dictation";
import ReportsPage from "@/pages/workspace/reports";
import WorklistPage from "@/pages/workspace/worklist";
import PatientsPage from "@/pages/studies/patients";
import ImagingPage from "@/pages/studies/imaging";
import AiAssistantPage from "@/pages/ai/assistant";
import SmartSuggestionsPage from "@/pages/ai/suggestions";
import TemplatesPage from "@/pages/ai/templates";
import AnalyticsPage from "@/pages/analytics";
import AdminPage from "@/pages/admin";
import SettingsPage from "@/pages/settings";
import NotFoundPage from "@/pages/not-found";

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/workspace/worklist" replace />} />
          <Route path="/dashboard" element={<Navigate to="/workspace/worklist" replace />} />

          <Route
            path="/workspace/dictation"
            element={
              <RoleGuard roles={["radiologist", "reporter", "admin"]}>
                <DictationPage />
              </RoleGuard>
            }
          />
          <Route path="/workspace/reports" element={<ReportsPage />} />
          <Route path="/workspace/reports/:studyId" element={<ReportsPage />} />
          <Route path="/workspace/worklist" element={<WorklistPage />} />

          <Route path="/studies/patients" element={<PatientsPage />} />
          <Route path="/studies/imaging" element={<ImagingPage />} />

          <Route
            path="/ai/assistant"
            element={
              <EnterpriseGuard>
                <RoleGuard roles={["radiologist", "reporter", "admin"]}>
                  <AiAssistantPage />
                </RoleGuard>
              </EnterpriseGuard>
            }
          />
          <Route
            path="/ai/suggestions"
            element={
              <EnterpriseGuard>
                <RoleGuard roles={["radiologist", "reporter", "admin"]}>
                  <SmartSuggestionsPage />
                </RoleGuard>
              </EnterpriseGuard>
            }
          />
          <Route
            path="/ai/templates"
            element={
              <EnterpriseGuard>
                <TemplatesPage />
              </EnterpriseGuard>
            }
          />

          <Route
            path="/analytics"
            element={
              <EnterpriseGuard>
                <RoleGuard roles={["admin", "radiologist"]}>
                  <AnalyticsPage />
                </RoleGuard>
              </EnterpriseGuard>
            }
          />
          <Route
            path="/admin/*"
            element={
              <RoleGuard roles={["admin"]}>
                <AdminPage />
              </RoleGuard>
            }
          />
          <Route path="/settings/*" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </TooltipProvider>
  );
}

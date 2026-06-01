import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { useIsEnterprise } from "@/features/license/api";
import type { RoleSlug } from "@/types/api";
import { Stethoscope, Rocket } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function RoleGuard({ roles, children }: { roles: RoleSlug[]; children: React.ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Erişim reddedildi"
        description="Bu modülü görüntülemek için gerekli yetkiye sahip değilsiniz. Yöneticinizle iletişime geçin."
      />
    );
  }
  return <>{children}</>;
}

export function EnterpriseGuard({ children }: { children: React.ReactNode }) {
  const isEnterprise = useIsEnterprise();
  const navigate = useNavigate();

  if (!isEnterprise) {
    return (
      <EmptyState
        icon={Rocket}
        title="Enterprise sürüm gerekli"
        description="Analitik ve gelişmiş raporlama özellikleri yalnızca Enterprise lisansında kullanılabilir. Yöneticinizden lisans etkinleştirmesini isteyin."
        action={
          <Button variant="outline" onClick={() => navigate("/admin/license")}>
            Lisans ayarları
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

export function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Stethoscope className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground">Medarix yükleniyor…</p>
      </div>
    </div>
  );
}

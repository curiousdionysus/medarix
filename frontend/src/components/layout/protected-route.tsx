import * as React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert, Rocket } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useIsEnterprise } from "@/features/license/api";
import { useT } from "@/features/i18n/locale-context";
import { EmptyState } from "@/components/shared/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import type { RoleSlug } from "@/types/api";

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: RoleSlug[] }) {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.some((r) => user.roles?.includes(r))) {
    return <RoleGuardDenied />;
  }
  return <>{children}</>;
}

export function EnterpriseRoute({ children }: { children: React.ReactNode }) {
  const isEnterprise = useIsEnterprise();
  if (!isEnterprise) return <EnterpriseGuardDenied />;
  return <>{children}</>;
}

export function RoleGuard({ children, roles }: { children: React.ReactNode; roles: RoleSlug[] }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) {
    return <RoleGuardDenied />;
  }
  return <>{children}</>;
}

function RoleGuardDenied() {
  const t = useT();
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <EmptyState
        icon={ShieldAlert}
        title={t("layout.accessDenied")}
        description={t("layout.accessDeniedDesc")}
      />
    </div>
  );
}

export function EnterpriseGuard({ children }: { children: React.ReactNode }) {
  const isEnterprise = useIsEnterprise();
  if (!isEnterprise) return <EnterpriseGuardDenied />;
  return <>{children}</>;
}

function EnterpriseGuardDenied() {
  const t = useT();
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <EmptyState
        icon={Rocket}
        title={t("layout.enterpriseRequired")}
        description={t("layout.enterpriseRequiredDesc")}
        action={
          <Button asChild variant="outline">
            <Link to="/admin">{t("layout.licenseSettings")}</Link>
          </Button>
        }
      />
    </div>
  );
}

export function FullScreenLoader() {
  const t = useT();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">{t("layout.appLoading")}</p>
    </div>
  );
}

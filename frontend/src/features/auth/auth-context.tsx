import * as React from "react";
import {
  api,
  clearSession,
  getAccessToken,
  logoutSession,
  restoreSession,
  setUnauthorizedHandler,
  storeSession,
} from "@/lib/api";
import type { RoleSlug, TokenResponse, UserOut } from "@/types/api";

interface AuthState {
  user: UserOut | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: RoleSlug[]) => boolean;
  hasPermission: (permission: string) => boolean;
  isAuthenticated: boolean;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserOut | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchMe = React.useCallback(async () => {
    const { data } = await api.get<UserOut>("/auth/me");
    setUser(data);
  }, []);

  const logout = React.useCallback(() => {
    void logoutSession().finally(() => {
      setUser(null);
    });
  }, []);

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!getAccessToken()) {
          const restored = await restoreSession();
          if (!restored) return;
        }
        await fetchMe();
      } catch {
        clearSession();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchMe]);

  const login = React.useCallback(
    async (username: string, password: string) => {
      const { data } = await api.post<TokenResponse>("/auth/login", { username, password });
      storeSession(data);
      await fetchMe();
    },
    [fetchMe],
  );

  const hasRole = React.useCallback(
    (...roles: RoleSlug[]) => {
      if (!user) return false;
      if (roles.length === 0) return true;
      return roles.some((r) => user.roles.includes(r));
    },
    [user],
  );

  const hasPermission = React.useCallback(
    (permission: string) => {
      if (!user?.permissions?.length) return false;
      const perms = user.permissions;
      if (perms.includes("*")) return true;
      if (perms.includes(permission)) return true;
      const ns = permission.includes(":") ? `${permission.split(":")[0]}:*` : null;
      return ns ? perms.includes(ns) : false;
    },
    [user],
  );

  const value = React.useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser: fetchMe,
      hasRole,
      hasPermission,
      isAuthenticated: !!user,
    }),
    [user, loading, login, logout, fetchMe, hasRole, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

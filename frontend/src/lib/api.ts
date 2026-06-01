import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { TokenResponse } from "@/types/api";
import { getStoredLocale, translateForLocale } from "@/features/i18n/locale-context";

const STORAGE_KEYS = {
  tokenExpiresAt: "medarixTokenExpiresAt",
  language: "medarixLanguage",
  theme: "medarixTheme",
  contrast: "medarixContrast",
} as const;

const LEGACY_AUTH_KEYS = [
  "medarixToken",
  "medarixRefreshToken",
  "meddictateToken",
  "meddictateRefreshToken",
  "voxradToken",
  "voxradRefreshToken",
];

const LEGACY_MEDDICTATE_KEYS: Record<keyof typeof STORAGE_KEYS, string> = {
  tokenExpiresAt: "meddictateTokenExpiresAt",
  language: "meddictateLanguage",
  theme: "meddictateTheme",
  contrast: "meddictateContrast",
};

const LEGACY_VOXRAD_KEYS: Record<keyof typeof STORAGE_KEYS, string> = {
  tokenExpiresAt: "voxradTokenExpiresAt",
  language: "voxradLanguage",
  theme: "voxradTheme",
  contrast: "voxradContrast",
};

function readStoredItem(key: keyof typeof STORAGE_KEYS): string {
  const current = localStorage.getItem(STORAGE_KEYS[key]);
  if (current !== null && current !== "") return current;
  for (const legacyKey of [LEGACY_MEDDICTATE_KEYS[key], LEGACY_VOXRAD_KEYS[key]]) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null && legacy !== "") {
      localStorage.setItem(STORAGE_KEYS[key], legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
  }
  return "";
}

function writeStoredItem(key: keyof typeof STORAGE_KEYS, value: string) {
  localStorage.setItem(STORAGE_KEYS[key], value);
  localStorage.removeItem(LEGACY_MEDDICTATE_KEYS[key]);
  localStorage.removeItem(LEGACY_VOXRAD_KEYS[key]);
}

function removeStoredItem(key: keyof typeof STORAGE_KEYS) {
  localStorage.removeItem(STORAGE_KEYS[key]);
  localStorage.removeItem(LEGACY_MEDDICTATE_KEYS[key]);
  localStorage.removeItem(LEGACY_VOXRAD_KEYS[key]);
}

function purgeLegacyAuthStorage() {
  for (const key of LEGACY_AUTH_KEYS) {
    localStorage.removeItem(key);
  }
}

export const storage = {
  get(key: keyof typeof STORAGE_KEYS): string {
    return readStoredItem(key);
  },
  set(key: keyof typeof STORAGE_KEYS, value: string) {
    writeStoredItem(key, value);
  },
  remove(key: keyof typeof STORAGE_KEYS) {
    removeStoredItem(key);
  },
};

purgeLegacyAuthStorage();

let accessToken = "";
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function getAccessToken() {
  return accessToken;
}

export function storeSession(data: TokenResponse) {
  accessToken = data.access_token;
  const expiresAt = Date.now() + (data.expires_in || 1800) * 1000;
  storage.set("tokenExpiresAt", String(expiresAt));
}

export function clearSession() {
  accessToken = "";
  storage.remove("tokenExpiresAt");
  purgeLegacyAuthStorage();
}

export function getTokenExpiresAt(): number {
  return Number(storage.get("tokenExpiresAt") || 0);
}

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

function legacyRefreshBody(): { refresh_token: string } | Record<string, never> {
  for (const key of LEGACY_AUTH_KEYS) {
    const legacy = localStorage.getItem(key);
    if (key.includes("Refresh") && legacy) {
      return { refresh_token: legacy };
    }
  }
  return {};
}

export async function performRefresh(): Promise<string> {
  const legacyBody = legacyRefreshBody();
  const { data } = await axios.post<TokenResponse>("/api/v1/auth/refresh", legacyBody, {
    withCredentials: true,
  });
  purgeLegacyAuthStorage();
  storeSession(data);
  return data.access_token;
}

export async function restoreSession(): Promise<boolean> {
  try {
    await performRefresh();
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function logoutSession(): Promise<void> {
  const legacyBody = legacyRefreshBody();
  try {
    await api.post("/auth/logout", legacyBody);
  } catch {
    /* ignore */
  }
  clearSession();
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const isAuthPath =
      url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");

    if (status === 401 && original && !original._retry && !isAuthPath) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? performRefresh();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        refreshPromise = null;
        clearSession();
        onUnauthorized?.();
      }
    }
    if (status === 401 && !isAuthPath) {
      clearSession();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(
  error: unknown,
  fallback = translateForLocale(getStoredLocale(), "errors.fallback"),
): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (error.response?.status === 503 || error.response?.status === 502)
      return translateForLocale(getStoredLocale(), "errors.aiUnavailable");
    if (error.response?.status === 403)
      return translateForLocale(getStoredLocale(), "errors.forbidden");
    if (error.response?.status === 401)
      return translateForLocale(getStoredLocale(), "errors.unauthorized");
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

/** Raw authorized fetch for binary responses (PDF, audio). */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" });
}

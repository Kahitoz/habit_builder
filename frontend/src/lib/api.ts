import { useAuthStore } from "./store";
import type { AuthResponse } from "./types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** Error thrown for non-2xx API responses. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Include the access token (default: true). Auth endpoints pass false. */
  auth?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Rotate the refresh token. Single-flight: concurrent 401s share one
 * refresh request, and the old token is never reused (the server
 * invalidates it on rotation).
 */
export function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) return false;
      try {
        const data = await api<AuthResponse>("/auth/refresh", {
          method: "POST",
          body: { refreshToken },
          auth: false,
        });
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        useAuthStore.getState().clearAuth();
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Perform an authenticated (by default) API request. On a 401 the client
 * attempts one token rotation and retries; if that fails the session is
 * cleared and the app guard redirects to /login.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const needsAuth = options.auth !== false;
  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const token = useAuthStore.getState().accessToken;
    if (needsAuth && token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  };

  let response = await doFetch();
  if (response.status === 401 && needsAuth) {
    const refreshed = await refreshTokens();
    if (refreshed) response = await doFetch();
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (response.status === 401 && needsAuth) {
      // Session is dead; drop it so the UI guard redirects.
      useAuthStore.getState().clearAuth();
    }
    throw new ApiError(
      response.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? `Request failed (${response.status})`,
    );
  }
  return data as T;
}

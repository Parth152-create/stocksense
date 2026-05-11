/**
 * lib/auth.ts
 */

let _accessToken: string | null = null;

export function getToken(): string | null {
  if (_accessToken) return _accessToken;
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("access_token");
  }
  return null;
}

export function setToken(token: string): void {
  _accessToken = token;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("access_token", token);
  }
}

export function clearToken(): void {
  _accessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("access_token");
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function redirectIfSessionExpired(): void {
  if (typeof window !== "undefined") {
    window.location.href = "/login?reason=session_expired";
  }
}

let _refreshPromise: Promise<boolean> | null = null;

async function silentRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch("http://localhost:8081/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        clearToken();
        return false;
      }

      const data = await res.json();
      // Backend returns { token: "..." } not { accessToken: "..." }
      const incoming = data.token ?? data.accessToken;
      if (incoming) {
        setToken(incoming);
        return true;
      }
      return false;
    } catch {
      clearToken();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

type FetchOptions = RequestInit & { _retry?: boolean };

export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const token = getToken();

  const headers = new Headers(options.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Prefix relative URLs with backend base
  const fullUrl = url.startsWith("http") ? url : `http://localhost:8081${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !options._retry) {
    const refreshed = await silentRefresh();

    if (refreshed) {
      const newToken = getToken();
      const retryHeaders = new Headers(options.headers ?? {});
      if (newToken) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      }
      return fetch(fullUrl, {
        ...options,
        headers: retryHeaders,
        credentials: "include",
        _retry: true,
      } as FetchOptions);
    } else {
      redirectIfSessionExpired();
    }
  }

  return response;
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8081/ws/prices";

export function getWebSocketUrl(symbol?: string): string {
  const token = getToken();
  const base = symbol ? `${WS_BASE}?symbol=${symbol}` : WS_BASE;
  return token ? `${base}${symbol ? "&" : "?"}token=${token}` : base;
}

export interface LoginResponse {
  token: string;       // ← backend field name
  accessToken?: string; // ← fallback in case it changes
  email: string;
  name?: string;
  id?: number;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch("http://localhost:8081/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error ?? "Login failed");
  }

  const data: LoginResponse = await res.json();
  // Accept either field name from backend
  const incoming = data.token ?? data.accessToken;
  if (incoming) setToken(incoming);
  return data;
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<void> {
  const res = await fetch("http://localhost:8081/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(err.error ?? "Registration failed");
  }

  const data = await res.json();
  const incoming = data.token ?? data.accessToken;
  if (incoming) setToken(incoming);
}

export async function googleAuth(credential: string): Promise<void> {
  const res = await fetch("http://localhost:8081/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Google auth failed" }));
    throw new Error(err.error ?? "Google auth failed");
  }

  const data = await res.json();
  const incoming = data.token ?? data.accessToken;
  if (incoming) setToken(incoming);
}

export async function logout(): Promise<void> {
  try {
    await fetch("http://localhost:8081/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // best-effort
  } finally {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}
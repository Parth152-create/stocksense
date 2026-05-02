// lib/auth.ts
const API = "http://localhost:8081";

// ── Token cookie helpers ─────────────────────────────────────────────────────

export function setToken(token: string) {
  // httpOnly would be better but we're edge-middleware validating it
  document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax`;
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? match[1] : null;
}

export function clearToken() {
  document.cookie = "token=; path=/; max-age=0";
}

export function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth API calls ───────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  email: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  setToken(data.token);
  return data;
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
  setToken(data.token);
  return data;
}

export async function googleAuth(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Google auth failed");
  setToken(data.token);
  return data;
}

export function logout() {
  clearToken();
  window.location.href = "/login";
}
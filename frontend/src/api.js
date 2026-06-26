// In dev, Vite proxies /api/* → localhost:8080, so we use relative URLs.
// In production, set VITE_API_URL to the deployed backend URL.
const API = import.meta.env.VITE_API_URL || "";

const TOKEN_KEY = "deadline_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Called when a request comes back 401 — lets the app boot us to /login.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function req(path, opts = {}) {
  const token = tokenStore.get();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 401) {
    tokenStore.clear();
    onUnauthorized();
    throw new Error("401");
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // ---- auth ----
  register: (email, password, name) =>
    req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email, password) =>
    req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  googleLogin: (credential) =>
    req("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  authConfig: () => req("/api/auth/config"),
  me: () => req("/api/auth/me"),
  updateProfile: (updates) =>
    req("/api/auth/profile", { method: "PATCH", body: JSON.stringify(updates) }),

  // ---- brain-dump / tasks ----
  braindump: (text) =>
    req("/api/braindump", { method: "POST", body: JSON.stringify({ text }) }),

  tasks: () => req("/api/tasks"),
  updateTask: (id, updates) =>
    req(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  deleteTask: (id) => req(`/api/tasks/${id}`, { method: "DELETE" }),
  kickstart: (id, kind) =>
    req(`/api/tasks/${id}/kickstart`, { method: "POST", body: JSON.stringify({ kind }) }),
  whyNow: (id) => req(`/api/tasks/${id}/why`),
  realityCheck: () => req("/api/reality-check"),

  approvals: () => req("/api/approvals"),
  resolve: (id, decision) =>
    req(`/api/approvals/${id}`, { method: "POST", body: JSON.stringify({ decision }) }),

  chat: (message, history = []) =>
    req("/api/chat", { method: "POST", body: JSON.stringify({ message, history }) }),

  suggest: () => req("/api/suggest"),

  habits: () => req("/api/habits"),
  createHabit: (data) =>
    req("/api/habits", { method: "POST", body: JSON.stringify(data) }),
  checkHabit: (id, date) =>
    req(`/api/habits/${id}/check`, { method: "POST", body: JSON.stringify({ date }) }),
  deleteHabit: (id) => req(`/api/habits/${id}`, { method: "DELETE" }),

  tick: () => req("/tick", { method: "POST" }),
};

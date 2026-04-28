export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)aeroops_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}

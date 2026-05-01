export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)aeroops_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  try {
    const res = await fetch(input, { ...init, headers, credentials: "include" });
    
    if (res.status === 401 && !input.includes("/api/auth/me") && !input.includes("/api/auth/login")) {
      window.location.href = `${BASE}/login?error=expired`;
    }

    if (res.status === 403) {
      const clone = res.clone();
      try {
        const data = await clone.json();
        if (data.message?.includes("deactivated")) {
          window.location.href = `${BASE}/login?error=deactivated`;
        }
      } catch {}
    }
    
    return res;
  } catch (err) {
    console.error("Network error during authFetch:", err);
    throw new Error("Network Error: Please check your internet connection.");
  }
}


const API_BASE =
  (process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "").trim() ||
  "http://localhost:8000";

const BACKEND_INTERNAL_API_KEY =
  (process.env.BACKEND_INTERNAL_API_KEY || "").trim();

export function getBackendUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function getBackendHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (BACKEND_INTERNAL_API_KEY) {
    headers["X-Internal-API-Key"] = BACKEND_INTERNAL_API_KEY;
  }
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

/** Headers for backend calls when body is FormData (do not set Content-Type). */
export function getBackendHeadersForm(): Record<string, string> {
  return getBackendHeaders(false);
}

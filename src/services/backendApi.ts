export const BACKEND_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
const failures = new Map<string, string>();
const listeners = new Set<() => void>();
export function backendErrorMessage(): string | null { return failures.values().next().value ?? null; }
export function subscribeBackendErrors(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function backendRequest<T>(path: string, init: RequestInit = {}, allowNotFound = false): Promise<T> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, { ...init, cache: 'no-store', signal: init.signal ?? AbortSignal.timeout(8000) });
    if (allowNotFound && response.status === 404) {
      failures.delete(path); listeners.forEach(listener => listener());
      return null as T;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.success !== true || !('data' in json)) throw new Error('INVALID_BACKEND_RESPONSE');
    failures.delete(path); listeners.forEach(listener => listener());
    return json.data as T;
  } catch (error) {
    failures.set(path, `Không tải hoặc lưu được dữ liệu Backend (${path}). Vui lòng thử lại; thay đổi chưa được xác nhận.`);
    listeners.forEach(listener => listener());
    throw error;
  }
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

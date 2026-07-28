const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5087'

const TOKEN_KEY = 'investlab_token'
const EXPIRES_AT_KEY = 'investlab_expires_at'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getExpiresAt(): number | null {
  const raw = localStorage.getItem(EXPIRES_AT_KEY)
  if (!raw) return null
  const ms = new Date(raw).getTime()
  return Number.isNaN(ms) ? null : ms
}

export function setExpiresAt(expiresAt: string | null): void {
  if (expiresAt) localStorage.setItem(EXPIRES_AT_KEY, expiresAt)
  else localStorage.removeItem(EXPIRES_AT_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Registrado por AuthProvider — se llama en cuanto una respuesta 401 revela que la sesión ya no
 * es válida (token vencido/revocado), para limpiar sesión y disparar el redirect a /login sin que
 * cada hook individual tenga que revisar el status code. */
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!path.startsWith('/')) {
    throw new Error(`Ruta de API inválida: "${path}" debe empezar con "/".`)
  }

  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      ...init,
    })
  } catch (err) {
    throw new Error(
      err instanceof Error && err.message
        ? `No se pudo conectar con el servidor: ${err.message}`
        : 'No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.',
    )
  }

  if (!res.ok) {
    if (res.status === 401) onSessionExpired?.()

    const body = await res.json().catch(() => ({}))
    const firstValidationError = body?.errors
      ? (Object.values(body.errors)[0] as string[] | undefined)?.[0]
      : undefined
    throw new ApiError(
      firstValidationError ??
        body?.detail ??
        body?.mensaje ??
        body?.title ??
        'Ocurrió un error inesperado. Intentá de nuevo en unos segundos.',
      res.status,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
}

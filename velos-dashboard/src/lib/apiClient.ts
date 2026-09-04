const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
const API_KEY = import.meta.env.VITE_DASHBOARD_API_KEY

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiGet<T>(
  path: string,
  params?: object,
): Promise<T> {
  const url = new URL(API_BASE_URL + path)

  if (params) {
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (API_KEY) headers['x-dashboard-key'] = API_KEY

  const response = await fetch(url.toString(), { headers })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // response was not JSON — keep the generic message
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

export async function apiPost<T>(path: string, body: object): Promise<T> {
  const url = new URL(API_BASE_URL + path)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (API_KEY) headers['x-dashboard-key'] = API_KEY

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // response was not JSON — keep the generic message
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

import axios from 'axios'
import type { ApiErrorResponse } from '@/types/api'

/**
 * A single, predictable error shape for the whole app.
 *
 * The two backends report failures very differently:
 *  - the Express auth service returns `{ code: "INVALID_PASSWORD" }`
 *  - the .NET API returns bare strings, `{ code: "..." }`, `ErrorResponse`,
 *    or ASP.NET Core `ProblemDetails` with a nested `errors` map
 * Normalising here means UI code never has to guess.
 */
export class ApiError extends Error {
  readonly status: number
  /** Stable machine-readable identifier, when the server supplied one. */
  readonly code?: string
  /** Per-field validation messages from ASP.NET Core model validation. */
  readonly fieldErrors?: Record<string, string[]>
  readonly traceId?: string
  readonly isNetworkError: boolean
  readonly isCanceled: boolean

  constructor(init: {
    message: string
    status: number
    code?: string
    fieldErrors?: Record<string, string[]>
    traceId?: string
    isNetworkError?: boolean
    isCanceled?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors
    this.traceId = init.traceId
    this.isNetworkError = init.isNetworkError ?? false
    this.isCanceled = init.isCanceled ?? false
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /** 5xx and transport failures are worth retrying; 4xx are not. */
  get isRetryable(): boolean {
    return this.isNetworkError || this.status >= 500
  }
}

function extractMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const body = data as ApiErrorResponse
    return body.message || body.title || body.details || body.code || fallback
  }
  return fallback
}

/** Convert anything thrown by axios (or by us) into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isCancel(error)) {
    return new ApiError({ message: 'Request canceled', status: 0, isCanceled: true })
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ApiError({
        message: error.message || 'Network request failed',
        status: 0,
        code: error.code,
        isNetworkError: true,
      })
    }

    const { status, data } = error.response
    const body = (typeof data === 'object' && data !== null ? data : {}) as ApiErrorResponse

    return new ApiError({
      message: extractMessage(data, error.message || `Request failed with status ${status}`),
      status,
      code: typeof body.code === 'string' ? body.code : undefined,
      fieldErrors: body.errors,
      traceId: body.traceId,
    })
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message, status: 0 })
  }

  return new ApiError({ message: 'An unexpected error occurred', status: 0 })
}

/**
 * Map an error onto an i18n key under `errors.*`.
 * Falls back to a status-based key, then to a generic one, so every failure
 * surfaces a translated message instead of a raw server string.
 */
export function errorTranslationKey(error: unknown): string {
  const apiError = toApiError(error)

  if (apiError.isCanceled) return 'errors.canceled'
  if (apiError.isNetworkError) return 'errors.network'
  if (apiError.code) return `errors.codes.${apiError.code}`

  switch (apiError.status) {
    case 400:
      return 'errors.badRequest'
    case 401:
      return 'errors.unauthorized'
    case 403:
      return 'errors.forbidden'
    case 404:
      return 'errors.notFound'
    case 409:
      return 'errors.conflict'
    default:
      return apiError.status >= 500 ? 'errors.server' : 'errors.unknown'
  }
}

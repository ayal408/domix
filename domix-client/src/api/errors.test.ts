import { describe, expect, it } from 'vitest'
import { AxiosError, CanceledError } from 'axios'
import { ApiError, errorTranslationKey, toApiError } from '@/api/errors'

function axiosErrorWithResponse(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = { status, data, statusText: '', headers: {}, config: {} as never }
  return error
}

describe('toApiError', () => {
  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError({ message: 'boom', status: 500 })
    expect(toApiError(original)).toBe(original)
  })

  it('marks a canceled axios request as isCanceled', () => {
    const canceled = new CanceledError('canceled')
    const result = toApiError(canceled)
    expect(result.isCanceled).toBe(true)
  })

  it('marks a response-less axios error as a network error', () => {
    const error = new AxiosError('Network Error')
    const result = toApiError(error)
    expect(result.isNetworkError).toBe(true)
    expect(result.status).toBe(0)
  })

  it('extracts a plain-string response body', () => {
    const result = toApiError(axiosErrorWithResponse(400, 'Bad input'))
    expect(result.message).toBe('Bad input')
    expect(result.status).toBe(400)
  })

  it('extracts message/code/errors from a structured response body', () => {
    const result = toApiError(
      axiosErrorWithResponse(422, {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
        errors: { email: ['is taken'] },
        traceId: 'trace-123',
      }),
    )
    expect(result.code).toBe('EMAIL_EXISTS')
    expect(result.message).toBe('Email already registered')
    expect(result.fieldErrors).toEqual({ email: ['is taken'] })
    expect(result.traceId).toBe('trace-123')
  })

  it('falls back to ProblemDetails-style "title"/"detail" fields', () => {
    const result = toApiError(axiosErrorWithResponse(500, { title: 'Server error' }))
    expect(result.message).toBe('Server error')
  })

  it('wraps a plain Error', () => {
    const result = toApiError(new Error('plain failure'))
    expect(result.message).toBe('plain failure')
    expect(result.status).toBe(0)
  })

  it('wraps an entirely unknown thrown value', () => {
    const result = toApiError('literally a string')
    expect(result.message).toBe('An unexpected error occurred')
  })
})

describe('ApiError status helpers', () => {
  it.each([
    [401, 'isUnauthorized'],
    [403, 'isForbidden'],
    [404, 'isNotFound'],
  ] as const)('flags status %d via %s', (status, flag) => {
    const error = new ApiError({ message: 'x', status })
    expect(error[flag]).toBe(true)
  })

  it('treats network errors and 5xx as retryable, 4xx as not', () => {
    expect(new ApiError({ message: 'x', status: 0, isNetworkError: true }).isRetryable).toBe(true)
    expect(new ApiError({ message: 'x', status: 503 }).isRetryable).toBe(true)
    expect(new ApiError({ message: 'x', status: 400 }).isRetryable).toBe(false)
  })
})

describe('errorTranslationKey', () => {
  it('prefers a known error code over the status', () => {
    expect(errorTranslationKey(axiosErrorWithResponse(400, { code: 'INVALID_PASSWORD' }))).toBe(
      'errors.codes.INVALID_PASSWORD',
    )
  })

  it('maps known status codes to their i18n keys', () => {
    expect(errorTranslationKey(axiosErrorWithResponse(400, {}))).toBe('errors.badRequest')
    expect(errorTranslationKey(axiosErrorWithResponse(401, {}))).toBe('errors.unauthorized')
    expect(errorTranslationKey(axiosErrorWithResponse(403, {}))).toBe('errors.forbidden')
    expect(errorTranslationKey(axiosErrorWithResponse(404, {}))).toBe('errors.notFound')
    expect(errorTranslationKey(axiosErrorWithResponse(409, {}))).toBe('errors.conflict')
    expect(errorTranslationKey(axiosErrorWithResponse(500, {}))).toBe('errors.server')
  })

  it('falls back to a generic key for an unrecognised status', () => {
    expect(errorTranslationKey(axiosErrorWithResponse(418, {}))).toBe('errors.unknown')
  })

  it('maps a network error to the network key', () => {
    expect(errorTranslationKey(new AxiosError('Network Error'))).toBe('errors.network')
  })
})

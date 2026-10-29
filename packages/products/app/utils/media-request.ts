// Media content can be binary. Keep these explicit domain responses independent
// of Nitro's generated JSON response inference for dynamic content URLs.
export interface MediaRequest {
  <T = unknown>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
      query?: Record<string, unknown>
      signal?: AbortSignal
      responseType?: 'blob'
    }
  ): Promise<T>
}

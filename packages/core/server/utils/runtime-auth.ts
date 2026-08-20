import { getPortalRequestContext } from './request-context'

type AuthMethod = (...args: never[]) => unknown

export const createRequestAwareAuth = <Auth extends object>(fallback: Auth) =>
  new Proxy(fallback, {
    get(_target, property) {
      const auth = (getPortalRequestContext()?.auth as Auth | undefined) ?? fallback
      const value = Reflect.get(auth, property, auth)
      return typeof value === 'function' ? (value as AuthMethod).bind(auth) : value
    }
  }) as Auth

import { mediaError } from '../utils/media-editor'

export const useMediaError = () => {
  const { t } = useI18n()
  const mt = useMediaText()
  const keys: Record<number, string> = {
    400: 'invalidDetails',
    401: 'authentication',
    403: 'permission',
    404: 'unavailable',
    409: 'conflict',
    413: 'tooLarge',
    422: 'invalidImage',
    502: 'storage',
    503: 'storage'
  }
  return (cause: unknown) => {
    const error = cause as { statusCode?: number; status?: number; response?: { status?: number } }
    const status = error?.statusCode || error?.status || error?.response?.status
    if (status && keys[status]) {
      return t(`products.media.errors.${keys[status]}`)
    }
    if (status && status >= 500) {
      return t('products.media.errors.save')
    }
    return mt(mediaError(cause))
  }
}

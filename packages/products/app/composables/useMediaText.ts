import { mediaTextKeys } from '../utils/media-text-keys'

export const useMediaText = () => {
  const { t } = useI18n()
  return (text: string) => (mediaTextKeys[text] ? t(`products.media.studio.${mediaTextKeys[text]}`) : text)
}

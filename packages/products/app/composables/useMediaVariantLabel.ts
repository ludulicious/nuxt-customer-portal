import type { MediaVariantPreset } from '../../shared/media-variants'

export const useMediaVariantLabel = () => {
  const { t } = useI18n()
  const defaults: Record<string, string> = { thumbnail: 'Thumbnail', gallery: 'Gallery', detail: 'Detail' }
  return (preset: Pick<MediaVariantPreset, 'key' | 'label'>) =>
    defaults[preset.key] === preset.label ? t(`products.media.variants.${preset.key}`) : preset.label
}

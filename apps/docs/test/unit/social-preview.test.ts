import { describe, expect, it } from 'vitest'
import { socialPreviewTitleSize, truncateSocialPreviewTitle } from '../../app/utils/social-preview'

describe('social preview titles', () => {
  it('preserves titles that fit in the preview', () => {
    expect(truncateSocialPreviewTitle('Nuxt Customer Portal')).toBe('Nuxt Customer Portal')
  })

  it('normalizes whitespace before measuring a title', () => {
    expect(truncateSocialPreviewTitle('  Account   and organizations  ')).toBe('Account and organizations')
  })

  it('truncates long documentation titles at a word boundary', () => {
    const title = 'Configure authentication providers and administrator access for production deployments'
    const result = truncateSocialPreviewTitle(title, 58)

    expect(result).toBe('Configure authentication providers and administrator…')
    expect(result.length).toBeLessThanOrEqual(58)
  })

  it('never clips a title made from one long word', () => {
    expect(truncateSocialPreviewTitle('pneumonoultramicroscopicsilicovolcanoconiosis', 24)).toBe('…')
  })

  it('uses progressively smaller display sizes for longer titles', () => {
    expect(socialPreviewTitleSize('Short title')).toContain('text-[72px]')
    expect(socialPreviewTitleSize('A documentation title that wraps onto two lines')).toContain('text-[60px]')
    expect(socialPreviewTitleSize('A deliberately long documentation title that requires more space')).toContain(
      'text-[52px]'
    )
  })
})

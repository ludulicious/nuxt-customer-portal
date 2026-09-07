export function truncateSocialPreviewTitle(title: string, maximumLength = 72): string {
  const normalizedTitle = title.trim().replace(/\s+/g, ' ')

  if (normalizedTitle.length <= maximumLength) {
    return normalizedTitle
  }

  const availableTitle = normalizedTitle.slice(0, maximumLength - 1)
  const lastWordBoundary = availableTitle.lastIndexOf(' ')

  if (lastWordBoundary < 1) {
    return '…'
  }

  return `${availableTitle.slice(0, lastWordBoundary)}…`
}

export function socialPreviewTitleSize(title: string): string {
  if (title.length > 56) {
    return 'text-[52px] leading-[1.06]'
  }

  if (title.length > 36) {
    return 'text-[60px] leading-[1.04]'
  }

  return 'text-[72px] leading-[1.02]'
}

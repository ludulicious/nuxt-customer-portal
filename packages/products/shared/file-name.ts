export function fileExtension(fileName: string) {
  return fileName.match(/\.[a-z0-9]+$/i)?.[0] || ''
}

export function withoutFileExtension(fileName: string, sourceFileName: string) {
  const extension = fileExtension(sourceFileName)
  const trimmed = fileName.trim()
  return extension && trimmed.toLowerCase().endsWith(extension.toLowerCase())
    ? trimmed.slice(0, -extension.length).trimEnd()
    : trimmed
}

export function withFileExtension(fileName: string, sourceFileName: string) {
  const extension = fileExtension(sourceFileName)
  const baseName = withoutFileExtension(fileName, sourceFileName)
  return `${baseName}${extension}`
}

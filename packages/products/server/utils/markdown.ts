import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export const renderDescription = (source: string) =>
  sanitizeHtml(marked.parse(source, { async: false }), {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'hr',
      'code',
      'pre'
    ],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false
  })

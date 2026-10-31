import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export const renderLegalMarkdown = (source: string) =>
  sanitizeHtml(marked.parse(source, { async: false, breaks: true }), {
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
      'pre',
      'del',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td'
    ],
    allowedAttributes: { a: ['href', 'title'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false
  })

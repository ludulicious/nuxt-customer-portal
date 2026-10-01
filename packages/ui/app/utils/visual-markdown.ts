import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { JSONContent } from '@tiptap/core'

interface MarkdownNode {
  type: string
  value?: string
  children?: MarkdownNode[]
  depth?: number
  url?: string
  title?: string
  lang?: string
  meta?: string
  ordered?: boolean
  start?: number
  checked?: boolean | null
  position?: { start: { offset: number }; end: { offset: number } }
}
const parser = unified().use(remarkParse).use(remarkGfm)
const supported = new Set([
  'paragraph',
  'text',
  'strong',
  'emphasis',
  'link',
  'heading',
  'blockquote',
  'list',
  'listItem',
  'code',
  'inlineCode',
  'break',
  'thematicBreak'
])
function unsupported(node: MarkdownNode): boolean {
  return (
    !supported.has(node.type) ||
    (node.type === 'listItem' && node.children?.[0]?.type !== 'paragraph') ||
    Boolean(node.title || node.meta || node.checked != null) ||
    (node.children || []).some(unsupported)
  )
}
export function placeholderText(text: string, marks: NonNullable<JSONContent['marks']> = []): JSONContent[] {
  return text
    .split(/({{\s*[a-z0-9_]+\s*}})/gi)
    .filter(Boolean)
    .map((part) =>
      /^{{\s*[a-z0-9_]+\s*}}$/i.test(part)
        ? { type: 'markdownPlaceholder', attrs: { raw: part }, marks }
        : { type: 'text', text: part, marks }
    )
}
function inline(nodes: MarkdownNode[], marks: NonNullable<JSONContent['marks']> = []): JSONContent[] {
  return nodes.flatMap((node) => {
    const mark = ({ strong: 'bold', emphasis: 'italic', link: 'link' } as Record<string, string>)[node.type]
    if (mark) {
      return inline(node.children || [], [
        ...marks,
        { type: mark, ...(node.type === 'link' ? { attrs: { href: node.url } } : {}) }
      ])
    }
    if (node.type === 'break') {
      return [{ type: 'hardBreak' }]
    }
    return node.value
      ? node.type === 'inlineCode'
        ? [{ type: 'text', text: node.value, marks: [...marks, { type: 'code' }] }]
        : placeholderText(node.value, marks)
      : []
  })
}
function block(node: MarkdownNode): JSONContent {
  const content = () => (node.children || []).map(block)
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', content: inline(node.children || []) }
    case 'heading':
      return { type: 'heading', attrs: { level: node.depth }, content: inline(node.children || []) }
    case 'blockquote':
      return { type: 'blockquote', content: content() }
    case 'thematicBreak':
      return { type: 'horizontalRule' }
    case 'list':
      return {
        type: node.ordered ? 'orderedList' : 'bulletList',
        attrs: { start: node.start || 1 },
        content: content()
      }
    case 'listItem':
      return { type: 'listItem', content: content() }
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: node.lang },
        content: node.value ? [{ type: 'text', text: node.value }] : []
      }
    default:
      throw new Error(`Unsupported Markdown: ${node.type}`)
  }
}
// Adapted from Marpos Studio: preserve unsupported blocks as inert source.
// HTML, tables, images, reference links and checklists remain editable in source mode.
export function parseVisualMarkdown(source: string): JSONContent {
  try {
    const tree = parser.parse(source) as unknown as MarkdownNode
    return {
      type: 'doc',
      content: (tree.children || []).map((node) =>
        unsupported(node)
          ? {
              type: 'protectedMarkdown',
              attrs: { raw: source.slice(node.position!.start.offset, node.position!.end.offset) }
            }
          : block(node)
      )
    }
  } catch {
    return { type: 'doc', content: [{ type: 'protectedMarkdown', attrs: { raw: source } }] }
  }
}

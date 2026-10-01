import { Node, nodeInputRule } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

export function createProtectedMarkdown(isSyncing: () => boolean, onBlocked: () => void) {
  return Node.create({
    name: 'protectedMarkdown',
    group: 'block',
    atom: true,
    addAttributes: () => ({ raw: { default: '' } }),
    parseHTML: () => [{ tag: 'pre[data-protected-markdown]', getAttrs: (element) => ({ raw: element.textContent }) }],
    renderHTML: ({ node }) => ['pre', { 'data-protected-markdown': '' }, node.attrs.raw],
    renderMarkdown: (node) => node.attrs?.raw || '',
    addProseMirrorPlugins: () => [
      new Plugin({
        filterTransaction(transaction, state) {
          if (!transaction.docChanged || isSyncing()) {
            return true
          }
          const blocks = (doc: typeof state.doc) => {
            const counts = new Map<string, number>()
            doc.descendants((node) => {
              if (node.type.name === 'protectedMarkdown') {
                counts.set(node.attrs.raw, (counts.get(node.attrs.raw) || 0) + 1)
              }
            })
            return counts
          }
          const after = blocks(transaction.doc)
          for (const [raw, count] of blocks(state.doc)) {
            if ((after.get(raw) || 0) < count) {
              onBlocked()
              return false
            }
          }
          return true
        }
      })
    ]
  })
}

export function insertMarkdownPlaceholder(source: string, value: string, start = source.length, end = start) {
  return { value: source.slice(0, start) + value + source.slice(end), cursor: start + value.length }
}

// Tokens must serialize literally: ordinary Markdown text escapes underscores,
// which would stop the email renderer from recognizing placeholder names.
export const MarkdownPlaceholder = Node.create({
  name: 'markdownPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ raw: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-markdown-placeholder]', getAttrs: (element) => ({ raw: element.textContent }) }],
  renderHTML: ({ node }) => [
    'span',
    { 'data-markdown-placeholder': '', class: 'rounded bg-elevated px-1 font-mono text-sm' },
    node.attrs.raw
  ],
  renderMarkdown: (node) => node.attrs?.raw || '',
  addInputRules() {
    return [
      nodeInputRule({
        find: /({{\s*[a-z0-9_]+\s*}})$/i,
        type: this.type,
        getAttributes: (match) => ({ raw: match[1] })
      })
    ]
  }
})

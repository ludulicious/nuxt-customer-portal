import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { parseVisualMarkdown } from '../app/utils/visual-markdown'
import {
  createProtectedMarkdown,
  insertMarkdownPlaceholder,
  MarkdownPlaceholder
} from '../app/utils/protected-markdown'

const window = new Window({ url: 'http://localhost' })
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'getComputedStyle',
  'MutationObserver',
  'DOMParser'
]) {
  Object.defineProperty(globalThis, key, {
    value: key === 'window' ? window : window[key as keyof Window],
    configurable: true
  })
}
function createEditor(source: string, blocked = () => {}) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({ underline: false, strike: false }),
      Markdown,
      MarkdownPlaceholder,
      createProtectedMarkdown(() => false, blocked)
    ],
    content: parseVisualMarkdown(source)
  })
}

test('visual edits retain placeholders and serialize formatting', () => {
  const editor = createEditor('Hello {{customer_name}}\n\nWelcome')
  editor.commands.setTextSelection({ from: 1, to: 6 })
  editor.commands.toggleBold()
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, [
    { type: 'text', text: ' ' },
    { type: 'markdownPlaceholder', attrs: { raw: '{{portal_url}}' } }
  ])
  assert.match(editor.getMarkdown(), /\*\*Hello\*\*/)
  assert.match(editor.getMarkdown(), /{{customer_name}}/)
  assert.match(editor.getMarkdown(), /{{portal_url}}/)
  assert.equal(editor.commands.undo(), true)
  assert.doesNotMatch(editor.getMarkdown(), /{{portal_url}}/)
  editor.destroy()
})

test('HTML, tables, reference links, images and special code survive adjacent edits', () => {
  const special = [
    '<div>{{html_body}}</div>',
    '| A | B |\n| --- | --- |\n| x | y |',
    '[reference][id]\n\n[id]: https://example.com',
    '![alt](https://example.com/image.png)',
    '```js title="sample"\nconst x = 1\n```',
    '- [x] Complete'
  ]
  for (const source of special) {
    const editor = createEditor(`Before\n\n${source}\n\nAfter`)
    editor.commands.insertContentAt(2, 'new ')
    assert.ok(editor.getMarkdown().includes(source), `Lost protected source: ${source}`)
    editor.destroy()
  }
})

test('visual deletion cannot remove protected blocks, including duplicate blocks', () => {
  let blocked = 0
  const source = '<div>keep</div>\n\nText\n\n<div>keep</div>'
  const editor = createEditor(source, () => blocked++)
  editor.commands.selectAll()
  editor.commands.deleteSelection()
  assert.equal(blocked, 1)
  assert.equal(editor.getMarkdown().trimEnd(), source)
  editor.destroy()
})

test('parsing special content is inert and opening the editor emits no update', () => {
  let updates = 0
  const source = '<script>window.injected = true</script>\n\n**Text**'
  const editor = createEditor(source)
  editor.on('update', () => updates++)
  assert.equal(editor.view.dom.querySelector('script'), null)
  assert.equal(editor.view.dom.querySelector('pre')?.textContent, '<script>window.injected = true</script>')
  assert.equal(updates, 0)
  editor.destroy()
})

test('raw placeholder insertion replaces the selection and returns the cursor', () => {
  assert.deepEqual(insertMarkdownPlaceholder('Hello NAME!', '{{customer_name}}', 6, 10), {
    value: 'Hello {{customer_name}}!',
    cursor: 23
  })
  assert.deepEqual(insertMarkdownPlaceholder('', '{{portal_url}}'), { value: '{{portal_url}}', cursor: 14 })
})

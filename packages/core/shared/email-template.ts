type EmailNode =
  | { type: 'text'; value: string }
  | { type: 'value'; key: string }
  | { type: 'if'; key: string; yes: EmailNode[]; no: EmailNode[] }

function parseEmailTemplate(source: string, allowed: Set<string>, label = 'email'): EmailNode[] {
  const root: EmailNode[] = []
  const stack: Array<{ node: Extract<EmailNode, { type: 'if' }>; parent: EmailNode[]; otherwise: boolean }> = []
  let current = root
  let offset = 0
  const text = (value: string) => {
    if (/{{\s*(?:#if\b|\/if\b|else\b)/.test(value)) {
      throw new Error('Incomplete email conditional tag')
    }
    if (value) {
      current.push({ type: 'text', value })
    }
  }
  const checkKey = (key: string) => {
    if (!allowed.has(key)) {
      throw new Error(`Unknown ${label} placeholder: ${key}`)
    }
  }
  for (const match of source.matchAll(/{{([\s\S]*?)}}/g)) {
    text(source.slice(offset, match.index))
    offset = match.index + match[0].length
    const token = match[1]!.trim()
    const condition = token.match(/^#if\s+([a-z0-9_]+)$/i)
    if (condition) {
      checkKey(condition[1]!)
      if (stack.length >= 20) {
        throw new Error('Email conditionals may nest at most 20 levels')
      }
      const node: Extract<EmailNode, { type: 'if' }> = { type: 'if', key: condition[1]!, yes: [], no: [] }
      current.push(node)
      stack.push({ node, parent: current, otherwise: false })
      current = node.yes
    } else if (token === 'else') {
      const frame = stack.at(-1)
      if (!frame || frame.otherwise) {
        throw new Error('Unexpected {{else}} in email template')
      }
      frame.otherwise = true
      current = frame.node.no
    } else if (token === '/if') {
      const frame = stack.pop()
      if (!frame) {
        throw new Error('Unexpected {{/if}} in email template')
      }
      current = frame.parent
    } else if (/^[a-z0-9_]+$/i.test(token)) {
      checkKey(token)
      current.push({ type: 'value', key: token })
    } else {
      throw new Error(`Unsupported email template tag: {{${token}}}`)
    }
  }
  text(source.slice(offset))
  if (stack.length) {
    throw new Error('Missing {{/if}} in email template')
  }
  return root
}

export function validateEmailTemplateSyntax(source: string, allowed: Set<string>, label = 'email') {
  parseEmailTemplate(source, allowed, label)
}

export function renderEmailTemplate(source: string, values: Record<string, string>, allowed: Set<string>) {
  const nodes = parseEmailTemplate(source, allowed)
  const value = (key: string) => {
    if (!Object.hasOwn(values, key)) {
      throw new Error(`Missing email placeholder value: ${key}`)
    }
    return values[key]!
  }
  const render = (items: EmailNode[]): string =>
    items
      .map((node) => {
        if (node.type === 'text') {
          return node.value
        }
        if (node.type === 'value') {
          return value(node.key)
        }
        return render(value(node.key).trim() ? node.yes : node.no)
      })
      .join('')
  return render(nodes)
}

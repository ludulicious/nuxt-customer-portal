import prettierConfig from 'eslint-config-prettier/flat'

export const formattingConfigs = [
  prettierConfig,
  {
    rules: {
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'max-statements-per-line': ['error', { max: 1 }],
      'vue/html-self-closing': 'off',
      '@stylistic/member-delimiter-style': 'off'
    }
  }
]

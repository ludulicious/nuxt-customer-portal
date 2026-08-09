// @ts-check
import withNuxt, { defineFlatConfigs } from './.nuxt/eslint.config.mjs'

export default defineFlatConfigs(
  withNuxt({
    rules: {
      '@stylistic/comma-dangle': 'off',
      'nuxt/nuxt-config-keys-order': 'off',
      'vue/block-tag-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multi-word-component-names': 'off'
    }
  })
)

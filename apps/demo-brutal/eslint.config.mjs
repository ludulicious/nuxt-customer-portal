// @ts-check
import withNuxt, { defineFlatConfigs } from './.nuxt/eslint.config.mjs'

export default defineFlatConfigs(
  withNuxt({
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  })
)

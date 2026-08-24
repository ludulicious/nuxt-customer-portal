// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import { formattingConfigs } from '../../eslint-formatting.config.mjs'

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off'
  }
}).append(...formattingConfigs)

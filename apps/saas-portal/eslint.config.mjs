import withNuxt from './.nuxt/eslint.config.mjs'
import { formattingConfigs } from '../../eslint-formatting.config.mjs'

export default withNuxt().append(...formattingConfigs)

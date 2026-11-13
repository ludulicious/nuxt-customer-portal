if (!process.env.npm_config_user_agent?.startsWith('pnpm/')) {
  console.error(
    'This project supports pnpm only. Use the version in package.json. Fork the project to use another package manager.'
  )
  process.exit(1)
}

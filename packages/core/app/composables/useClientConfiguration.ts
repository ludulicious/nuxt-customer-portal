export const useClientConfiguration = () => {
  const runtime = useRuntimeConfig()
  const settings = useState<{ clients?: { allowedTypes: string[]; personalSelfRegistration: boolean } } | null>(
    'portal-runtime-settings',
    () => null
  )
  return computed(() => ({ ...runtime.public.clients, ...settings.value?.clients }))
}

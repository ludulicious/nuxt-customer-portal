<template>
  <div class="auth-shell min-h-screen flex flex-col">
    <main class="flex flex-1 items-center justify-center px-4 py-12">
      <UButton
        icon="i-lucide-chevron-left"
        to="/"
        size="xl"
        color="neutral"
        variant="subtle"
        class="auth-back-button absolute left-8 top-8 rounded-full z-10"
      />

      <UPageCard
        variant="subtle"
        class="max-w-sm w-full"
      >
        <slot />
      </UPageCard>
    </main>

    <AppFooter />
  </div>
</template>

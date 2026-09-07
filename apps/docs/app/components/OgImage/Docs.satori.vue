<script lang="ts" setup>
import { socialPreviewTitleSize, truncateSocialPreviewTitle } from '../../utils/social-preview'

const props = defineProps<{ pageTitle?: string; headline?: string; tagline?: string; siteName?: string }>()

const title = computed(() => truncateSocialPreviewTitle(props.pageTitle || 'Nuxt Customer Portal'))
const titleSize = computed(() => socialPreviewTitleSize(title.value))
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#020420] text-white overflow-hidden px-[84px] py-[68px]">
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center">
        <img src="/logo.svg" width="72" height="72" alt="" class="mr-[24px]" />
        <p class="m-0 text-[28px] leading-none font-semibold tracking-[-0.02em]">
          {{ siteName || 'Nuxt Customer Portal' }}
        </p>
      </div>
      <p class="m-0 text-[19px] leading-none text-[#B8C0D9] tracking-[0.04em]">nuxt-customer-portal.com</p>
    </div>

    <div class="flex flex-1 flex-col justify-center w-[1010px] pt-[30px]">
      <p v-if="headline" class="m-0 mb-[22px] text-[22px] leading-none text-[#6EE2F5] font-semibold">
        {{ headline }}
      </p>
      <h1 class="m-0 font-semibold tracking-[-0.045em] text-white" :class="titleSize">
        {{ title }}
      </h1>
      <p v-if="tagline" class="m-0 mt-[30px] text-[30px] leading-[1.25] text-[#D8DCEF] w-[900px]">
        {{ tagline }}
      </p>
    </div>

    <div class="flex w-full h-[8px]">
      <div class="w-[38%] h-full bg-[#6EE2F5]" />
      <div class="flex-1 h-full bg-[#6454F0]" />
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{ pageTitle?: string; pageDescription?: string; headline?: string }>()

const title = computed(() => (props.pageTitle || '').slice(0, 60))
const description = computed(() => (props.pageDescription || '').slice(0, 150))
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center bg-[#020420] overflow-hidden">
    <div class="absolute right-[-90px] top-[-110px] w-[520px] h-[520px] rounded-full bg-[#062f2d]" />
    <div class="absolute right-[40px] top-[20px] w-[340px] h-[340px] rounded-full" style="border: 3px solid #00dc82" />
    <div class="absolute right-[120px] top-[100px] w-[180px] h-[180px] rounded-full bg-[#00dc82]" />
    <div class="absolute right-[195px] top-[175px] w-[30px] h-[30px] rounded-full bg-[#020420]" />

    <div class="pl-[100px] w-[850px]">
      <p v-if="headline" class="uppercase text-[24px] text-[#00DC82] mb-4 font-semibold">
        {{ headline }}
      </p>
      <h1 v-if="title" class="m-0 text-[58px] leading-[1.05] font-semibold mb-4 text-white flex items-center">
        <span>{{ title }}</span>
      </h1>
      <p v-if="description" class="text-[27px] text-[#E4E4E7] leading-tight w-[760px]">
        {{ description }}
      </p>
    </div>
  </div>
</template>

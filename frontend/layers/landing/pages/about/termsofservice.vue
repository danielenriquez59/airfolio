<script setup lang="ts">
const supportEmail = useRuntimeConfig().public.supportEmail

definePageMeta({
  layout: 'simple',
})

useHead({
  title: 'Terms of Service - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'The terms that apply when you use Airfolio, create an account, or upload airfoils.',
    },
  ],
})

const sections = [
  {
    title: 'Using Airfolio',
    text: 'Airfolio is a free tool for browsing, analyzing, and comparing airfoils. By using the site you agree to these terms. If you do not agree, please do not use it.',
  },
  {
    title: 'Accounts',
    text: 'You need an account to upload airfoils. Keep your sign-in details safe; you are responsible for what happens under your account. We may suspend or remove accounts that break these terms.',
  },
  {
    title: 'Your uploads',
    items: [
      'Only upload airfoils you have the right to share.',
      'Uploaded airfoils become part of the public catalog. You may not be able to delete them yourself afterwards.',
      'You keep any rights you have in what you upload. You give Airfolio permission to store, display, analyze, and distribute it as part of the service, free of charge.',
      'We may edit or remove uploads, for example duplicates, errors, or content that breaks these terms.',
    ],
  },
  {
    title: 'Acceptable use',
    items: [
      'Do not try to break, overload, or get around the limits of the site or its servers.',
      'Do not upload unlawful, misleading, or harmful content.',
      'Do not use the site to violate anyone else\'s rights.',
    ],
  },
  {
    title: 'No warranty',
    text: 'Airfolio is provided "as is". Airfoil data may contain errors, and analysis results are estimates from numerical and machine-learning models. Do not rely on them for flight-critical, safety-critical, or certification work without independent verification.',
  },
  {
    title: 'Limitation of liability',
    text: 'To the extent the law allows, Airfolio and its maintainers are not liable for any loss or damage that results from using the site, its data, or its results.',
  },
  {
    title: 'Changes',
    text: 'We may change or stop the service, or update these terms, at any time. We will update this page and the date above when the terms change. Continuing to use the site means you accept the updated terms.',
  },
]
</script>

<template>
  <div class="page-container py-8">
    <div class="max-w-3xl">
      <PageHeader title="Terms of Service" subtitle="Last updated November 16, 2026" />

      <section v-for="section in sections" :key="section.title" class="mb-8">
        <h2 class="mb-2 text-base font-semibold text-gray-900">
          {{ section.title }}
        </h2>
        <p v-if="section.text" class="text-sm leading-relaxed text-gray-700">
          {{ section.text }}
        </p>
        <ul v-if="section.items" class="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
          <li v-for="item in section.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="mb-2 text-base font-semibold text-gray-900">
          Contact
        </h2>
        <p class="text-sm leading-relaxed text-gray-700">
          Questions about these terms:
          <a :href="`mailto:${supportEmail}`" class="font-medium text-primary-600 underline hover:text-primary-700">{{ supportEmail }}</a>.
          See also our
          <NuxtLink to="/about/privacypolicy" class="font-medium text-primary-600 underline hover:text-primary-700">Privacy Policy</NuxtLink>.
        </p>
      </section>
    </div>
  </div>
</template>

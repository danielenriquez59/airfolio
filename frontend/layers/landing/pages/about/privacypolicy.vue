<script setup lang="ts">
const supportEmail = useRuntimeConfig().public.supportEmail

definePageMeta({
  layout: 'simple',
})

useHead({
  title: 'Privacy Policy - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'What information Airfolio collects, how it is used, and the choices you have.',
    },
  ],
})

const sections = [
  {
    title: 'Information we collect',
    items: [
      'Account: your email address when you create an account. If you sign in with Google, we also receive your name and profile picture from Google. Passwords are stored in hashed form; we never see them.',
      'Uploads: airfoils you upload are added to the public catalog. We record which account uploaded each airfoil, but this is not shown publicly.',
      'Contact form: the email address and message you send us.',
      'Usage: we use Google Analytics, which sets cookies and collects pages visited, browser and device type, and approximate location.',
      'Analysis requests: the airfoil and flow conditions you analyze are sent to our server. Results are cached and are not linked to you.',
    ],
  },
  {
    title: 'Google sign-in data',
    items: [
      'What we access: if you choose "Sign in with Google", Airfolio receives your name, email address, and profile picture from your Google account. We request no other Google data and cannot see your password, contacts, files, or anything else in your Google account.',
      'How we use it: only to create your Airfolio account, sign you in, and identify your account (for example, to record which account uploaded an airfoil).',
      'How we store it: in our sign-in database, hosted by Supabase, for as long as your account exists.',
      'How we share it: we do not sell it, share it with third parties, or use it for advertising. It is not used to train AI or machine-learning models.',
      'How to remove it: delete your account and this data from the Account page, or email us to do it for you. You can also remove Airfolio\'s access at any time from your Google account settings.',
    ],
  },
  {
    title: 'How we use it',
    text: 'We use this information to run the site, sign you in, prevent abuse, reply to your messages, and understand how the site is used. We do not sell your information and we do not show ads.',
  },
  {
    title: 'Services we rely on',
    text: 'Your information is processed by the providers that run Airfolio: Supabase (database and sign-in), Netlify (hosting and the contact form), Render (analysis server), and Google (Analytics, Google sign-in, and fonts). We share it with no one else, unless the law requires it.',
  },
  {
    title: 'Cookies and browser storage',
    text: 'We store your sign-in session in your browser so you stay signed in. Google Analytics sets its own cookies. Some tools save your settings and notes in your browser only.',
  },
  {
    title: 'Your choices',
    text: 'You can delete your account and the information linked to it at any time from the Account page, or ask us to do it by email. Airfoils you uploaded may stay in the public catalog, with no link to you. You can block analytics cookies in your browser settings.',
  },
  {
    title: 'Children',
    text: 'Airfolio is not directed at children under 13, and we do not knowingly collect their information.',
  },
  {
    title: 'Changes',
    text: 'If we change this policy we will update this page and the date above.',
  },
]
</script>

<template>
  <div class="page-container py-8">
    <div class="max-w-3xl">
      <PageHeader title="Privacy Policy" subtitle="Last updated November 16, 2026" />

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
          Questions or deletion requests:
          <a :href="`mailto:${supportEmail}`" class="font-medium text-primary-600 underline hover:text-primary-700">{{ supportEmail }}</a>.
          See also our
          <NuxtLink to="/about/termsofservice" class="font-medium text-primary-600 underline hover:text-primary-700">Terms of Service</NuxtLink>.
        </p>
      </section>
    </div>
  </div>
</template>

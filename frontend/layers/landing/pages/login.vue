<script setup lang="ts">
definePageMeta({
  layout: 'simple',
})

useHead({
  title: 'Sign In - Airfolio',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const supabase = useSupabaseClient()
// undefined until the session is read on the client (the SSG HTML never has one), null when signed out
const signedInEmail = ref<string | null>()

onMounted(async () => {
  signedInEmail.value = (await supabase.auth.getSession()).data.session?.user.email ?? null
})
const route = useRoute()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const isSignUp = ref(false)
const confirmationSent = ref(false)

// Only follow same-site paths, so the link can't bounce users to another site.
const redirectTo = computed(() => {
  const target = route.query.redirect
  const isLocalPath = typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
  return isLocalPath ? target : '/'
})

async function handleSubmit() {
  isSubmitting.value = true
  errorMessage.value = ''
  const credentials = { email: email.value, password: password.value }
  const { data, error } = isSignUp.value
    ? await supabase.auth.signUp({
      ...credentials,
      // The confirmation email links back here, then on to where the user was going.
      options: { emailRedirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirectTo.value)}` },
    })
    : await supabase.auth.signInWithPassword(credentials)
  isSubmitting.value = false
  if (error) {
    errorMessage.value = error.message
    return
  }
  // No session after sign-up means the email still has to be confirmed.
  if (!data.session) {
    confirmationSent.value = true
    return
  }
  await navigateTo(redirectTo.value)
}

async function handleSignOut() {
  await supabase.auth.signOut()
  signedInEmail.value = null
}
</script>

<template>
  <div class="page-container py-8">
    <div class="max-w-md">
      <PageHeader :title="isSignUp ? 'Create Account' : 'Sign In'" />

      <VPanel v-if="signedInEmail === undefined">
        <VStateBlock variant="loading" title="Checking sign-in..." />
      </VPanel>

      <VPanel v-else-if="signedInEmail !== null">
        <VStateBlock icon="heroicons:user-circle" title="Signed in" :description="signedInEmail">
          <VButton color="primary" :to="redirectTo">
            Continue
          </VButton>
          <VButton type="button" color="light" @click="handleSignOut">
            Sign out
          </VButton>
        </VStateBlock>
      </VPanel>

      <VPanel v-else-if="confirmationSent">
        <VStateBlock
          icon="heroicons:envelope"
          title="Check your email"
          :description="`We sent a confirmation link to ${email}. Open it to finish creating your account.`"
        />
      </VPanel>

      <VPanel v-else>
        <form class="space-y-5" @submit.prevent="handleSubmit">
          <div
            v-if="errorMessage"
            class="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800"
            role="alert"
          >
            <Icon name="heroicons:exclamation-triangle" class="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p>{{ errorMessage }}</p>
          </div>

          <VInput v-model="email" type="email" name="email" label="Email" autocomplete="email" required />
          <VInput v-model="password" type="password" name="password" label="Password" :autocomplete="isSignUp ? 'new-password' : 'current-password'" required />

          <p class="text-xs text-gray-500">
            By signing in or creating an account you agree to our
            <NuxtLink to="/about/termsofservice" class="text-primary-600 underline hover:text-primary-700">Terms of Service</NuxtLink>
            and
            <NuxtLink to="/about/privacypolicy" class="text-primary-600 underline hover:text-primary-700">Privacy Policy</NuxtLink>.
          </p>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <button type="button" class="text-sm text-primary-600 hover:text-primary-700 hover:underline" @click="isSignUp = !isSignUp">
              {{ isSignUp ? 'Have an account? Sign in' : 'New here? Create an account' }}
            </button>
            <VButton type="submit" color="primary" class="w-full sm:w-auto" :disabled="isSubmitting">
              {{ isSubmitting ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in' }}
            </VButton>
          </div>
        </form>
      </VPanel>
    </div>
  </div>
</template>

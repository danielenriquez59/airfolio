<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'simple',
})

useHead({
  title: 'Account - Airfolio',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const supabase = useSupabaseClient<Database>()
const config = useRuntimeConfig()

// undefined until the session is read on the client (the SSG HTML never has one), null when signed out
const email = ref<string | null>()
const uploads = ref<{ id: string; created_at: string; airfoil: { name: string; display_name: string | null } }[]>()
const uploadsError = ref('')

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')

onMounted(async () => {
  const session = (await supabase.auth.getSession()).data.session
  email.value = session?.user.email ?? null
  if (!session)
    return
  const { data, error } = await supabase
    .from('airfoil_uploads')
    .select('airfoil_id, created_at, airfoils(name, display_name)')
    .order('created_at', { ascending: false })
  if (error) {
    uploadsError.value = error.message
    return
  }
  uploads.value = data.flatMap(u => u.airfoils ? [{ id: u.airfoil_id, created_at: u.created_at, airfoil: u.airfoils }] : [])
})

async function handleSignOut() {
  // 'local' clears this browser even when the network call would fail
  await supabase.auth.signOut({ scope: 'local' })
  await navigateTo('/')
}

// The upload the delete confirmation is open for, if any
const uploadToDelete = ref<{ id: string; airfoil: { name: string; display_name: string | null } }>()
const uploadDeleteError = ref('')

async function confirmDeleteUpload() {
  const target = uploadToDelete.value
  if (!target)
    return
  isDeleting.value = true
  uploadDeleteError.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch(`${config.public.backendUrl}/api/airfoils/${target.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    uploads.value = uploads.value?.filter(u => u.id !== target.id)
    uploadToDelete.value = undefined
  }
  catch (err) {
    uploadDeleteError.value = (err as any)?.data?.detail || (err instanceof Error ? err.message : 'Failed to delete airfoil')
  }
  finally {
    isDeleting.value = false
  }
}

async function confirmDeleteAccount() {
  isDeleting.value = true
  deleteError.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch(`${config.public.backendUrl}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
  }
  catch (err) {
    deleteError.value = (err as any)?.data?.detail || (err instanceof Error ? err.message : 'Failed to delete account')
    isDeleting.value = false
    return
  }
  // The user is already gone on the server, so a failed sign-out only leaves a dead local session.
  await supabase.auth.signOut().catch(() => {})
  showDeleteModal.value = false
  await navigateTo('/')
}
</script>

<template>
  <div class="page-container py-8">
    <div class="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Account" />

      <VPanel v-if="email === undefined">
        <VStateBlock variant="loading" title="Checking sign-in..." />
      </VPanel>

      <VPanel v-else-if="email === null">
        <VStateBlock icon="heroicons:lock-closed" title="Sign in to view your account">
          <VButton color="primary" to="/login?redirect=/account">
            Sign in
          </VButton>
        </VStateBlock>
      </VPanel>

      <template v-else>
        <VPanel title="Signed in">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-gray-700">
              {{ email }}
            </p>
            <VButton type="button" color="light" @click="handleSignOut">
              Sign out
            </VButton>
          </div>
        </VPanel>

        <VPanel title="My uploaded airfoils">
          <VStateBlock v-if="uploadsError" variant="error" title="Could not load your uploads" :description="uploadsError" />
          <VStateBlock v-else-if="!uploads" variant="loading" title="Loading uploads..." />
          <VStateBlock v-else-if="!uploads.length" title="You haven't uploaded any airfoils yet">
            <VButton color="primary" to="/upload">
              Upload an airfoil
            </VButton>
          </VStateBlock>
          <ul v-else class="divide-y divide-gray-200">
            <li v-for="u in uploads" :key="u.id" class="flex items-center gap-3 py-2 text-sm">
              <NuxtLink :to="`/airfoils/${encodeURIComponent(u.airfoil.name)}`" class="min-w-0 truncate font-medium text-primary-600 hover:text-primary-700 hover:underline">
                {{ u.airfoil.display_name || u.airfoil.name }}
              </NuxtLink>
              <span class="num ml-auto shrink-0 text-gray-500">{{ new Date(u.created_at).toLocaleDateString() }}</span>
              <button
                type="button"
                class="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
                :aria-label="`Delete ${u.airfoil.display_name || u.airfoil.name}`"
                @click="uploadDeleteError = ''; uploadToDelete = u"
              >
                <Icon name="heroicons:trash" class="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </VPanel>

        <VPanel title="Delete account">
          <p class="text-sm text-gray-700">
            Permanently deletes your account and sign-in details. Airfoils you uploaded stay in the public catalog, with no link to you. To remove them, delete them above first.
          </p>
          <p v-if="deleteError && !showDeleteModal" class="mt-3 text-sm text-error-700" role="alert">
            {{ deleteError }}
          </p>
          <VButton type="button" color="error" size="sm" class="mt-4" :disabled="isDeleting" @click="deleteError = ''; showDeleteModal = true">
            <Icon name="heroicons:trash" class="h-4 w-4" aria-hidden="true" />
            Delete account
          </VButton>
        </VPanel>
      </template>
    </div>

    <VModalConfirm
      :model-value="!!uploadToDelete"
      title="Delete airfoil"
      :confirm-label="isDeleting ? 'Deleting…' : 'Delete airfoil'"
      :busy="isDeleting"
      :error="uploadDeleteError"
      @update:model-value="uploadToDelete = undefined"
      @confirm="confirmDeleteUpload"
    >
      <p class="text-sm text-gray-700">
        Permanently delete <span class="font-semibold">{{ uploadToDelete?.airfoil.display_name || uploadToDelete?.airfoil.name }}</span>
        from the catalog? This cannot be undone.
      </p>
    </VModalConfirm>

    <VModalConfirm
      v-model="showDeleteModal"
      title="Delete account"
      :confirm-label="isDeleting ? 'Deleting…' : 'Delete account'"
      :busy="isDeleting"
      :error="deleteError"
      @confirm="confirmDeleteAccount"
    >
      <p class="text-sm text-gray-700">
        Permanently delete the account <span class="font-semibold">{{ email }}</span>? This cannot be undone.
        Airfoils you uploaded will stay in the public catalog, with no link to you.
      </p>
    </VModalConfirm>
  </div>
</template>

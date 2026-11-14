<script lang="ts" setup>
import { useField, useForm } from 'vee-validate'
import { object, string } from 'yup'
import { useAuthStore } from '~~/stores/auth'

useHead({
  title: 'Login',
})

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

const { handleSubmit } = useForm({
  validationSchema: object({
    email: string().required().email().label('Email'),
    password: string().required().label('Password'),
  }),
})

const auth = useAuthStore()
const router = useRouter()
const error = ref()
const route = useRoute()

const { store } = useAuthStorage()

const { value: email } = useField('email', undefined, {
  initialValue: '',
})
const { value: password } = useField('password', undefined, {
  initialValue: '',
})

const onSubmit = handleSubmit(async (values) => {
  error.value = ''
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'post',
      body: values,
    })

    const token = res.token
    const user = res.user

    store(token, user)

    auth.user = user
    auth.loggedIn = true

    router.push((route.query as any).next || '/')
  }
  catch (e: any) {
    error.value = e.data.error
  }
})
</script>

<template>
  <div>
    <form
      class="p-6 sm:p-8"
      @submit="onSubmit"
    >
      <AuthHeader title="Login" subtitle="Please enter your credentials" />

      <div v-if="error" class="mb-4 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-800" role="alert">
        {{ error }}
      </div>

      <VInput
        v-model="email"
        wrapper-class="mb-4"
        name="email"
        label="Email"
        placeholder="Email"
        hint="Email: admin@example.com"
      />
      <VInput
        v-model="password"
        wrapper-class="mb-4"
        name="password"
        label="Password"
        placeholder="Password"
        type="password"
        hint="Password: admin"
      />

      <div class="mb-5 flex gap-2 justify-between items-center">
        <label class="flex gap-2 items-center text-sm">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          >
          Remember me
        </label>
        <nuxt-link to="/auth/forgot-password" class="text-primary-600 hover:text-primary-700 hover:underline font-medium text-sm">
          Forgot Password?
        </nuxt-link>
      </div>

      <VButton type="submit" color="primary" block class="mb-5">
        Login
      </VButton>

      <!-- <button
        class="px-3 py-2.5 rounded-md mb-4 font-semibold inline-flex w-full items-center justify-center bg-primary-500 text-white border-primary-500 focus:ring focus:ring-primary-500 focus:ring-offset-1 transition duration-300 hover:bg-primary-600 hover:border-primary-600"
      >
        Login
      </button> -->

      <div class="text-center text-sm text-gray-600">
        Don't have account?
        <nuxt-link to="/auth/register" class="text-primary-600 hover:text-primary-700 hover:underline font-medium text-sm">
          Register
        </nuxt-link>
      </div>
    </form>
  </div>
</template>

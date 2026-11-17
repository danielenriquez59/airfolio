<script setup lang="ts">
definePageMeta({
  layout: 'simple',
})

useHead({
  title: 'API Documentation - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Fetch airfoil coordinates from Airfolio as JSON with a simple, free HTTP API. Includes Python and curl examples.',
    },
  ],
})

const baseUrl = useRuntimeConfig().public.backendUrl
const endpoint = `${baseUrl}/api/v1/airfoils/naca2412/coordinates`

const pythonExample = `import requests
import numpy as np

url = "${endpoint}"
data = requests.get(url).json()

xy = np.array(data["coordinates"])  # shape (N, 2)
x, y = xy[:, 0], xy[:, 1]`

const curlExample = `curl ${endpoint}`

const responseExample = `{
  "id": "b69e99e3-2628-40da-b015-b1df7767e314",
  "name": "naca2412",
  "coordinates": [
    [1.0, 0.0],
    [0.999849, 0.000039],
    ...
    [0.999849, -0.000018],
    [1.0, 0.0]
  ]
}`

const fields = [
  { name: 'id', text: 'The airfoil\'s unique ID.' },
  { name: 'name', text: 'The airfoil\'s name, as used in its page address.' },
  { name: 'coordinates', text: 'A list of [x, y] points, as fractions of the chord. The points form one loop in Selig order: from the upper trailing edge, around the leading edge, to the lower trailing edge.' },
]

const errors = [
  { code: '404', text: 'No airfoil with that name or ID.' },
  { code: '429', text: 'Too many requests. The Retry-After header gives the number of seconds to wait.' },
]

const codeClass = 'overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800'
const inlineCodeClass = 'rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800'
</script>

<template>
  <div class="page-container py-8">
    <div class="max-w-3xl">
      <PageHeader title="API Documentation" subtitle="Fetch airfoil coordinates from your own scripts. Free, no sign-in or API key needed." />

      <section class="mb-8">
        <h2 class="mb-2 text-base font-semibold text-gray-900">
          Get airfoil coordinates
        </h2>
        <pre :class="codeClass">GET {{ baseUrl }}/api/v1/airfoils/{name_or_id}/coordinates</pre>
        <p class="mt-3 text-sm leading-relaxed text-gray-700">
          Replace <code :class="inlineCodeClass">{name_or_id}</code> with the airfoil's name or ID.
          The name is the last part of the airfoil's page address: for
          <NuxtLink to="/airfoils/naca2412" class="font-medium text-primary-600 underline hover:text-primary-700">airfolio.live/airfoils/naca2412</NuxtLink>
          it is <code :class="inlineCodeClass">naca2412</code>. Upper and lower case are treated the same.
          Find airfoils on the <NuxtLink to="/search" class="font-medium text-primary-600 underline hover:text-primary-700">search page</NuxtLink>.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="mb-2 text-base font-semibold text-gray-900">
          Response
        </h2>
        <pre :class="codeClass">{{ responseExample }}</pre>
        <dl class="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">
          <div v-for="field in fields" :key="field.name">
            <dt class="inline">
              <code :class="inlineCodeClass">{{ field.name }}</code>
            </dt>
            <dd class="inline">
              {{ field.text }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="mb-8">
        <h2 class="mb-2 text-base font-semibold text-gray-900">
          Examples
        </h2>
        <h3 class="data-label mb-2">
          Python
        </h3>
        <pre :class="codeClass">{{ pythonExample }}</pre>
        <h3 class="data-label mb-2 mt-4">
          curl
        </h3>
        <pre :class="codeClass">{{ curlExample }}</pre>
      </section>

      <section class="mb-8">
        <h2 class="mb-2 text-base font-semibold text-gray-900">
          Limits and errors
        </h2>
        <p class="text-sm leading-relaxed text-gray-700">
          You can make up to 60 requests per minute.
        </p>
        <dl class="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">
          <div v-for="error in errors" :key="error.code">
            <dt class="inline">
              <code :class="inlineCodeClass">{{ error.code }}</code>
            </dt>
            <dd class="inline">
              {{ error.text }}
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-sm leading-relaxed text-gray-700">
          Use of the API is covered by our
          <NuxtLink to="/about/termsofservice" class="font-medium text-primary-600 underline hover:text-primary-700">Terms of Service</NuxtLink>.
          Questions or problems? Use the <NuxtLink to="/contact" class="font-medium text-primary-600 underline hover:text-primary-700">contact page</NuxtLink>.
        </p>
      </section>
    </div>
  </div>
</template>

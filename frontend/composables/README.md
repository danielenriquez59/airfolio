# Composables Documentation

This directory contains reusable composables for airfoil data operations.

## Available Composables

### `useAirfoils`

Main airfoil CRUD operations.

```typescript
const { 
  fetchAirfoil, 
  fetchAirfoilGeometry, 
  fetchRandomAirfoils 
} = useAirfoils()

// Get single airfoil
const airfoil = await fetchAirfoil('uuid-here')

// Get geometry only (for plotting)
const geometry = await fetchAirfoilGeometry('uuid-here')

// Get random airfoils for featured section
const featured = await fetchRandomAirfoils(3)
```

### `useAirfoilSearch`

Search and filter airfoils.

```typescript
const { searchAirfoils } = useAirfoilSearch()

// Search with filters
const results = await searchAirfoils({
  query: 'naca',
  thicknessMin: 10,
  thicknessMax: 15,
  camberMin: 2,
  camberMax: 5,
  page: 1,
  limit: 20
})

// Returns: { data, count, page, limit, totalPages }
```

### `useAnalysis`

Submit and retrieve analysis jobs.

```typescript
const { 
  submitAnalysis, 
} = useAnalysis()

// Submit single analysis
const response = await submitAnalysis('airfoil-id', {
  Re: 3000000,
  Mach: 0.1,
  alpha_range: [-4, 16, 0.5],
  n_crit: 9.0
})
```

### `useBatchJobs`

Batch job operations.

```typescript
const { 
  submitBatchJob,
  fetchBatchJobStatus,
  fetchBatchJobs,
  fetchBatchJobResults 
} = useBatchJobs()

// Submit batch job
const job = await submitBatchJob({
  scope: 'compare',
  airfoilIds: ['id1', 'id2'],
  conditions: { Re: 3000000, alpha_range: [-4, 16, 0.5] }
})

// Get job status
const status = await fetchBatchJobStatus('job-id')

// List all jobs
const allJobs = await fetchBatchJobs()
const queuedJobs = await fetchBatchJobs('queued')

// Get results when done
const results = await fetchBatchJobResults('job-id')
```

## Configuration

The backend URL is configured in `nuxt.config.ts`:

```typescript
runtimeConfig: {
  public: {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8000'
  }
}
```

Set `BACKEND_URL` environment variable to point to your FastAPI backend.


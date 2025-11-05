# Airfoil Analysis Backend

FastAPI backend service for submitting airfoil analysis jobs.

## Overview

This backend handles:
- Single airfoil analysis requests (`POST /api/analyze`)
- Multi-airfoil comparison requests (`POST /api/analyze/compare`)
- Job status queries (`GET /api/jobs/{job_id}`)

The backend uses **AeroSandbox** for aerodynamic analysis calculations.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- FastAPI and Uvicorn (web framework)
- AeroSandbox[full] (aerodynamic analysis)
- Supabase client (database access)
- Other required dependencies

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon key (for client operations)
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (for server operations)
- `REDIS_URL`: Redis connection URL (for job queue)

### Running the Backend

To run the backend, navigate to the `backend` directory and execute the appropriate command:

**Development Mode:**
```bash
uvicorn main:app --reload --port 8000
```
This will start the server with auto-reloading enabled, useful for development.

**Production Mode:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
This command runs the server in production mode, listening on all available network interfaces.

## API Endpoints

### POST /api/analyze
Submit a single airfoil analysis job.

**Request:**
```json
{
  "airfoil_id": "uuid-here",
  "conditions": {
    "Re": 3000000,
    "Mach": 0.1,
    "alpha_range": [-4, 16, 0.5],
    "n_crit": 9.0
  }
}
```

**Response:**
```json
{
  "job_id": "job-uuid",
  "cached": false,
  "results": null
}
```

### POST /api/analyze/compare
Submit a comparison analysis for multiple airfoils.

**Request:**
```json
{
  "airfoil_ids": ["uuid-1", "uuid-2"],
  "conditions": {
    "Re": 3000000,
    "Mach": 0.1,
    "alpha_range": [-4, 16, 0.5]
  }
}
```

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "queued",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### GET /api/jobs/{job_id}
Get the status of an analysis job.

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "running",
  "progress": 45,
  "result_location": null
}
```

## Architecture

- **FastAPI**: Web framework for API endpoints
- **AeroSandbox**: Performs aerodynamic analysis calculations
- **Supabase**: Database for storing jobs and cached results
- **Redis**: Job queue for asynchronous processing (TODO)

## Development Notes

- The backend focuses solely on analysis job submission
- Catalogue queries (GET /api/airfoils) should be handled by Nuxt server routes or Cloudflare Workers
- Analysis results are cached in the `performance_cache` table to avoid recomputation


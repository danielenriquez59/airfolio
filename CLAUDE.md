# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Airfolio is a web-based airfoil search and analysis platform. Users can browse, filter, and compare airfoils based on geometric characteristics (thickness, camber) and analyze their aerodynamic performance under specified flow conditions using AI-powered NeuralFoil analysis via AeroSandbox.

**Tech Stack:**
- Frontend: Nuxt 3 (Vue) + TypeScript + Tailwind CSS
- Database & Auth: Supabase (Postgres + Auth + Storage)
- Backend Analysis Service: FastAPI (Python)
- Package Manager: pnpm
- Deployment: Frontend on Netlify, Backend on Render

## Important Development Rules

**Terminal & Commands:**
- Use Windows CMD terminal for all commands (not PowerShell or bash)
- Use `pnpm` for all package management (never npm or yarn)
- **NEVER run git commands** - user handles all version control
- **NEVER run build commands** - user handles builds

**Code Philosophy:**
- Keep code minimal - only implement what's explicitly requested
- Reuse existing UI components before creating new ones
- **DO NOT create additional markdown files or documentation** unless explicitly asked
- Use separation of concerns - break components into files when appropriate

## Common Commands

### Frontend (Nuxt 3)

**Development:**
```bash
cd frontend
pnpm dev
```
Runs on http://localhost:3000

**Linting:**
```bash
cd frontend
pnpm lint
pnpm lint:fix
```

**Other Available Commands:**
```bash
pnpm build          # Build for production
pnpm generate       # Generate static site
pnpm preview        # Preview production build
pnpm storybook      # Run Storybook on port 6006
```

### Backend (FastAPI)

**Development Mode:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Production Mode:**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Install Dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

## Architecture

### Frontend Architecture

**Nuxt 3 Layers System:**
The frontend uses Nuxt's layer system for modular organization:
- `frontend/layers/admin/` - Admin panel layer
- `frontend/layers/auth/` - Authentication layer
- `frontend/layers/landing/` - Landing page layer
- `frontend/layers/ui/` - UI component library layer

**Key Directories:**
- `components/` - Global Vue components
- `composables/` - Reusable composition functions for airfoil operations
- `stores/` - Pinia state management (currently only `auth.ts`)
- `server/api/` - Nuxt server routes (currently only sitemap generation)
- `layouts/` - Layout components
- `content/` - Nuxt Content docs

**Important Composables:**
The composables handle most frontend logic:
- `useAirfoils.ts` - Airfoil data fetching and management
- `useAirfoilSearch.ts` - Search and filtering logic
- `useAnalysis.ts` - Analysis job submission
- `useCompare.ts` - Multi-airfoil comparison
- `useControlSurface.ts` - Flap/control surface analysis
- `useNACAGenerator.ts` - NACA airfoil generation
- `useCSTParameters.ts` - CST airfoil parameterization
- `useSparCalculator.ts` - Spar sizing calculations
- `useSchrenkCalculator.ts` - Schrenk lift distribution

### Backend Architecture

**FastAPI Service (`backend/main.py`):**
The backend is solely responsible for running aerodynamic analyses using AeroSandbox's NeuralFoil. It does NOT handle catalog queries.

**Core Analysis Function (`airfoil_analysis.py`):**
Uses AeroSandbox to run NeuralFoil analysis:
- Accepts upper/lower surface coordinates
- Returns CL, CD, CM vs alpha arrays
- Supports multiple model sizes: "xxsmall" to "xxxlarge" (default: "xsmall")

**Key API Endpoints:**

1. **Single/Multi Airfoil Analysis:**
   ```
   POST /api/analyze
   Body: {
     "airfoil_ids": ["uuid-1", "uuid-2", ...],  // 1 for single, 2+ for compare
     "conditions": {
       "Re": 3000000,
       "Mach": 0.1,
       "alpha_range": [-4, 16, 0.5],
       "n_crit": 9.0
     }
   }
   ```
   - Single airfoil: Checks `performance_cache` first, returns cached if available
   - Multiple airfoils: Runs batch comparison, caches individually

2. **Control Surface Analysis:**
   ```
   POST /api/control-surface/analyze
   Body: {
     "airfoil_id": "uuid",
     "conditions": {...},
     "flap_configs": [
       {"deflection": 5.0, "hinge_point": 0.75},
       {"deflection": 10.0, "hinge_point": 0.75}
     ]
   }
   ```
   - Deflects airfoil geometry using `deflect_trailing_edge_flap()`
   - Analyzes each flap configuration
   - Caches results with flap parameters in condition hash

3. **Transient Analysis (No Caching):**
   ```
   POST /api/analyze-transient
   ```
   For CST, NACA, or custom airfoils that shouldn't be cached

4. **Airfoil Upload:**
   ```
   POST /api/airfoils/validate  // Validate coordinates & calculate properties
   POST /api/airfoils/create    // Create new airfoil in database
   ```

**Utility Functions (`utils.py`):**
- `generate_condition_hash()` - Creates hash for cache lookup
- `validate_monotonic()` - Validates x-coordinates are monotonic
- `extract_coordinates()` - Splits coordinates into upper/lower surfaces
- `calculate_properties()` - Calculates geometric properties using AeroSandbox
- `deflect_trailing_edge_flap()` - Applies flap deflection to coordinates

### Database Schema (Supabase Postgres)

**Main Tables:**

1. **`airfoils`** - Airfoil catalog
   - Stores geometry as separate coordinate arrays: `upper_x_coordinates`, `upper_y_coordinates`, `lower_x_coordinates`, `lower_y_coordinates`
   - Derived properties: `thickness_pct`, `thickness_loc_pct`, `camber_pct`, `camber_loc_pct`, `le_radius`, `te_thickness`, `te_angle`
   - `name` - Normalized alphanumeric name (unique, used in URLs)
   - `display_name` - Display name (can contain any characters)
   - `category` - Category text (references `categories.name`)

2. **`performance_cache`** - Cached analysis results
   - `airfoil_id` + `cond_hash` unique constraint
   - `inputs` - JSONB with exact conditions (Re, alpha_range, Mach, n_crit, flap parameters)
   - `outputs` - JSONB with analysis results (CL, CD, CM arrays)

3. **`batch_jobs`** - Async job tracking (future use)
   - `scope` - ENUM: 'single', 'compare', 'entire_db'
   - `status` - ENUM: 'queued', 'running', 'done', 'failed'

4. **`categories`** - Airfoil categories

**Important Indexes:**
- `idx_airfoils_name_trgm` - Fuzzy name search using pg_trgm
- `idx_airfoils_thickness_pct`, `idx_airfoils_camber_pct` - Filter indexes
- `idx_performance_cache_airfoil_id`, `idx_performance_cache_cond_hash` - Cache lookup

### Data Flow

**Airfoil Catalog Queries:**
- Handled by Nuxt server routes or directly via Supabase client
- Backend does NOT handle GET /api/airfoils queries

**Analysis Workflow:**
1. Frontend submits analysis request to FastAPI backend
2. Backend generates `cond_hash` from conditions + airfoil_id
3. Check `performance_cache` for existing results
4. If cache miss: Fetch coordinates, run NeuralFoil, cache results
5. Return analysis results to frontend

**Comparison Analysis:**
- Batch cache lookup for all airfoils in single query
- Run analysis only for cache misses
- Cache each result individually
- Return combined results keyed by airfoil name

## Configuration

**Environment Variables:**

Frontend (`frontend/.env`):
```
SUPABASE_URL=...
SUPABASE_KEY=...
BACKEND_URL=http://localhost:8000
NUXT_PUBLIC_SITE_URL=...
NUXT_PUBLIC_SUPPORT_EMAIL=...
```

Backend (`backend/.env`):
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_KEY=...
REDIS_URL=...  # For future job queue
```

## Special Features

**Pre-rendering:**
- `nuxt.config.ts` has a build hook that fetches all airfoil names from Supabase
- Generates routes for `/airfoils/{name}` to pre-render at build time
- Uses Nitro static preset for SSG deployment

**CST Parameterization:**
- `useCSTParameters.ts` handles CST (Class-Shape Transformation) airfoil generation
- Allows exporting custom airfoils to CST parameters

**NACA Generator:**
- `useNACAGenerator.ts` generates NACA 4-series and 5-series airfoils
- Direct analysis without database storage

**Spar & Schrenk Calculators:**
- `useSparCalculator.ts` - Wing spar sizing based on loads
- `useSchrenkCalculator.ts` - Lift distribution using Schrenk approximation
- Located at `backend/bezier_curve.py` for Bézier curve utilities

## Notes for AI Assistants

- Airfoil coordinates are stored as **separate arrays** (upper_x, upper_y, lower_x, lower_y), NOT as array of [x,y] pairs
- Upper surface goes from trailing edge → leading edge (x descending)
- Lower surface goes from leading edge → trailing edge (x ascending)
- All analysis uses NeuralFoil via AeroSandbox - analysis is NOT local XFOIL
- Performance caching is critical - always check cache before running analysis
- The `cond_hash` includes airfoil_id to ensure uniqueness
- For control surfaces, the hash also includes `flap_fraction` and `deflection`
- When flap deflection is 0, use `control_surface_fraction = 0` in hash (hinge point doesn't matter)

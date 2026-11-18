# Airfolio Backend

FastAPI service that runs NeuralFoil analyses (via AeroSandbox), handles airfoil uploads and serves the public coordinates API. Results for catalog airfoils are cached in the Supabase `performance_cache` table; catalog browsing goes straight to Supabase from the frontend.

## Run

```bash
pip install -r requirements.txt
cp .env.example .env            # then fill in the values
uvicorn main:app --reload --port 8000              # development
uvicorn main:app --host 0.0.0.0 --port 8000        # production
python -m pytest tests                              # tests
```

Environment variables (`.env`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`: Supabase project URL and service-role key.
- `CORS_ORIGINS`: optional JSON list of allowed origins.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET/HEAD | `/health` | Health check (also `GET /`) |
| GET | `/api/v1/airfoils/{name_or_id}/coordinates` | Public: `[x, y]` points in Selig order; 60 requests/min per IP |
| POST | `/api/analyze` | Catalog airfoils: `{"airfoil_ids": [...], "conditions": {"Re", "Mach", "alpha_range": [start, end, step], "n_crit"}}`. One id returns its polar in `results`; 2+ ids return polars keyed by airfoil name. Cached first, misses are run and cached |
| POST | `/api/control-surface/analyze` | One airfoil with 1-3 trailing-edge flap configs (`deflection`, `hinge_point`); returns geometry and polar per config, cached |
| POST | `/api/analyze-transient` | Uncached analysis of raw coordinates (NACA, CST, designer); at most 1000 points per surface and 200 angles; rate limited |
| POST | `/api/airfoils/validate` | Check upload coordinates and name, return geometric properties |
| POST | `/api/airfoils/recalculate-geometry` | Geometric properties for existing coordinates |
| POST | `/api/airfoils/create` | Signed-in upload (`Authorization: Bearer <token>`), 4 per day unless admin |
| DELETE | `/api/airfoils/{airfoil_id}` | Signed-in: delete an airfoil you uploaded |
| DELETE | `/api/account` | Signed-in: delete your account |
| POST | `/api/bezier-fit` | Fit Bezier curves (order 3-10) to upper and lower surfaces |

Interactive docs: `/docs` when the server runs.

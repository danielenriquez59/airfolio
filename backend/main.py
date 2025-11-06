"""
FastAPI backend for airfoil analysis job submission.
Handles analysis requests and job queuing.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from supabase import create_client, Client

from config import settings
from utils import generate_condition_hash
from airfoil_analysis import analyze_airfoil

app = FastAPI(
    title="Airfoil Analysis API",
    description="API for submitting airfoil analysis jobs",
    version="1.0.0"
)

# Initialize Supabase client
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class AnalysisConditions(BaseModel):
    """Flow conditions for analysis"""
    Re: float = Field(..., description="Reynolds number")
    Mach: float = Field(default=0.0, description="Mach number")
    alpha_range: List[float] = Field(..., description="Alpha range: [start, end, step]")
    n_crit: Optional[float] = Field(default=None, description="Critical N factor")
    has_control_surface: Optional[bool] = Field(default=False, description="Has control surface")
    control_surface_percent: Optional[float] = Field(default=None, description="Control surface percentage")


class AnalysisRequest(BaseModel):
    """Request for airfoil analysis (single or multiple)"""
    airfoil_ids: List[str] = Field(..., min_items=1, description="List of airfoil UUIDs (1 for single, 2+ for comparison)")
    conditions: AnalysisConditions


class JobResponse(BaseModel):
    """Response containing job information"""
    job_id: str
    status: str
    created_at: datetime


class AnalysisResponse(BaseModel):
    """Response for immediate analysis (if cached)"""
    job_id: Optional[str] = None
    cached: bool
    results: Optional[Dict[str, Any]] = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Airfoil Analysis API", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest):
    """
    Submit an airfoil analysis job (single or multiple airfoils).
    
    - Single airfoil (1 ID): Checks cache first, returns cached results if available
    - Multiple airfoils (2+ IDs): Creates a comparison job
    
    Checks cache first for single airfoil cases, then creates a job if not cached.
    """
    try:
        num_airfoils = len(request.airfoil_ids)
        
        if num_airfoils == 1:
            airfoil_id = request.airfoil_ids[0]
            cond_hash = generate_condition_hash(request.conditions, airfoil_id)

            # TODO: Check performance_cache table for existing results
            # SELECT * FROM performance_cache 
            # WHERE airfoil_id = airfoil_id AND cond_hash = cond_hash
            # If found, return cached results immediately:
            # return AnalysisResponse(
            #     job_id=None,
            #     cached=True,
            #     results=cached_results['outputs']
            # )
            
            # Fetch airfoil coordinates from database
            if not supabase:
                raise HTTPException(
                    status_code=500,
                    detail="Supabase client not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment variables."
                )
            
            try:
                # Query airfoil coordinates
                response = supabase.table('airfoils').select(
                    'id, name, upper_x_coordinates, upper_y_coordinates, lower_x_coordinates, lower_y_coordinates'
                ).eq('id', airfoil_id).single().execute()
                
                if not response.data:
                    raise HTTPException(status_code=404, detail=f"Airfoil with ID {airfoil_id} not found")
                
                airfoil_data = response.data
                
                # Extract coordinates
                upper_x_coords = airfoil_data['upper_x_coordinates']
                upper_y_coords = airfoil_data['upper_y_coordinates']
                lower_x_coords = airfoil_data['lower_x_coordinates']
                lower_y_coords = airfoil_data['lower_y_coordinates']
                airfoil_name   = airfoil_data.get('name', 'Airfoil')
                
                # Run analysis
                analysis_results = analyze_airfoil(
                    upper_x_coords=upper_x_coords,
                    upper_y_coords=upper_y_coords,
                    lower_x_coords=lower_x_coords,
                    lower_y_coords=lower_y_coords,
                    reynolds_number=request.conditions.Re,
                    mach_number=request.conditions.Mach,
                    alpha_range=request.conditions.alpha_range,
                    n_crit=request.conditions.n_crit if request.conditions.n_crit is not None else 9.0,
                    airfoil_name=airfoil_name
                )

                # Return results immediately (no job queuing for now)
                return AnalysisResponse(
                    job_id=None,
                    cached=False,
                    results=analysis_results
                )
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error running analysis: {str(e)}"
                )
        
        else:
            # Multiple airfoils - comparison analysis
            # Fetch all airfoils and run analysis for each
            if not supabase:
                raise HTTPException(
                    status_code=500,
                    detail="Supabase client not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment variables."
                )
            
            try:
                # Fetch all airfoil coordinates from database
                response = supabase.table('airfoils').select(
                    'id, name, upper_x_coordinates, upper_y_coordinates, lower_x_coordinates, lower_y_coordinates'
                ).in_('id', request.airfoil_ids).execute()
                
                if not response.data:
                    raise HTTPException(status_code=404, detail="No airfoils found with the provided IDs")
                
                airfoil_data_list = response.data
                
                # Check if we got all requested airfoils
                fetched_ids = {airfoil['id'] for airfoil in airfoil_data_list}
                requested_ids = set(request.airfoil_ids)
                missing_ids = requested_ids - fetched_ids
                
                if missing_ids:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Airfoils with IDs {list(missing_ids)} not found"
                    )
                
                # Create a map of airfoil_id -> airfoil_data for easy lookup
                airfoil_map = {airfoil['id']: airfoil for airfoil in airfoil_data_list}
                
                # Run analysis for each airfoil and collect results
                comparison_results = {}
                n_crit = request.conditions.n_crit if request.conditions.n_crit is not None else 9.0
                
                for airfoil_id in request.airfoil_ids:
                    airfoil_data = airfoil_map[airfoil_id]
                    
                    # Extract coordinates
                    upper_x_coords = airfoil_data['upper_x_coordinates']
                    upper_y_coords = airfoil_data['upper_y_coordinates']
                    lower_x_coords = airfoil_data['lower_x_coordinates']
                    lower_y_coords = airfoil_data['lower_y_coordinates']
                    airfoil_name = airfoil_data.get('name', f'Airfoil_{airfoil_id[:8]}')
                    
                    # Run analysis for this airfoil
                    analysis_results = analyze_airfoil(
                        upper_x_coords=upper_x_coords,
                        upper_y_coords=upper_y_coords,
                        lower_x_coords=lower_x_coords,
                        lower_y_coords=lower_y_coords,
                        reynolds_number=request.conditions.Re,
                        mach_number=request.conditions.Mach,
                        alpha_range=request.conditions.alpha_range,
                        n_crit=n_crit,
                        airfoil_name=airfoil_name
                    )
                    
                    # Store results keyed by airfoil name
                    comparison_results[airfoil_name] = analysis_results
                
                # Return combined results immediately
                return AnalysisResponse(
                    job_id=None,
                    cached=False,
                    results=comparison_results
                )
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error running comparison analysis: {str(e)}"
                )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting analysis: {str(e)}")


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the status of an analysis job.
    """
    # TODO: Query batch_jobs table for job status
    # TODO: If done, include result_location
    
    return {
        "job_id": job_id,
        "status": "queued",  # TODO: Get actual status from DB
        "progress": 0,  # TODO: Get actual progress from DB
        "result_location": None  # TODO: Get from DB if status is 'done'
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


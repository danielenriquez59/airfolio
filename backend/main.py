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

from config import settings
from utils import generate_condition_hash

app = FastAPI(
    title="Airfoil Analysis API",
    description="API for submitting airfoil analysis jobs",
    version="1.0.0"
)

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


class SingleAnalysisRequest(BaseModel):
    """Request for single airfoil analysis"""
    airfoil_id: str = Field(..., description="UUID of the airfoil")
    conditions: AnalysisConditions


class CompareAnalysisRequest(BaseModel):
    """Request for comparing multiple airfoils"""
    airfoil_ids: List[str] = Field(..., min_items=2, description="List of airfoil UUIDs to compare")
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
async def analyze_single(request: SingleAnalysisRequest):
    """
    Submit a single airfoil analysis job.
    
    Checks cache first, then creates a job if not cached.
    """
    try:
        # Generate condition hash for cache lookup
        cond_hash = generate_condition_hash(request.conditions)
        
        # TODO: Check performance_cache table for existing results
        # If found, return cached results immediately
        
        # TODO: If not cached, create job in batch_jobs table
        # For now, create a job ID and return it
        
        job_id = str(uuid.uuid4())
        
        # TODO: Insert job into batch_jobs table with status 'queued'
        # TODO: Queue job in Redis for processing
        
        return AnalysisResponse(
            job_id=job_id,
            cached=False,
            results=None
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting analysis: {str(e)}")


@app.post("/api/analyze/compare", response_model=JobResponse)
async def analyze_compare(request: CompareAnalysisRequest):
    """
    Submit a comparison analysis job for multiple airfoils.
    
    Creates a batch job for comparing multiple airfoils.
    """
    try:
        # Validate airfoil IDs
        if len(request.airfoil_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 airfoil IDs required for comparison"
            )
        
        job_id = str(uuid.uuid4())
        
        # TODO: Insert job into batch_jobs table with:
        # - scope: 'compare'
        # - airfoil_ids: request.airfoil_ids
        # - inputs: request.conditions.model_dump()
        # - status: 'queued'
        # TODO: Queue job in Redis for processing
        
        return JobResponse(
            job_id=job_id,
            status="queued",
            created_at=datetime.utcnow()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting comparison: {str(e)}")


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


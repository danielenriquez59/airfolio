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
from utils import (
    generate_condition_hash,
    validate_monotonic,
    extract_coordinates,
    calculate_properties,
    deflect_trailing_edge_flap,
)
from airfoil_analysis import analyze_airfoil
from bezier_fitting import BezierFitter

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
    control_surface_fraction: Optional[float] = Field(default=0.0, description="Control surface fraction")
    control_surface_deflection: Optional[float] = Field(default=0.0, description="Control surface deflection")


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


# Airfoil Upload Models

class CoordinatePair(BaseModel):
    """A single x, y coordinate pair"""
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")


class AirfoilValidationRequest(BaseModel):
    """Request to validate airfoil coordinates"""
    name: str = Field(..., min_length=1, description="Airfoil name")
    upper_surface: List[CoordinatePair] = Field(..., description="Upper surface coordinates")
    lower_surface: List[CoordinatePair] = Field(..., description="Lower surface coordinates")


class AirfoilValidationResponse(BaseModel):
    """Response containing validation status and calculated properties"""
    valid: bool
    errors: Optional[List[str]] = None
    calculated_properties: Optional[Dict[str, Any]] = None


class AirfoilCreateRequest(BaseModel):
    """Request to create a new airfoil"""
    name: str = Field(..., min_length=1, description="Normalized airfoil name (alphanumeric only)")
    display_name: Optional[str] = Field(None, description="Display name (any characters, defaults to name if not provided)")
    description: Optional[str] = None
    upper_surface: List[CoordinatePair] = Field(..., description="Upper surface coordinates")
    lower_surface: List[CoordinatePair] = Field(..., description="Lower surface coordinates")
    source_url: Optional[str] = None
    category: Optional[str] = Field(None, description="Category ID or name")


class AirfoilCreateResponse(BaseModel):
    """Response from airfoil creation"""
    success: bool
    airfoil_id: Optional[str] = None
    slug: Optional[str] = None
    error: Optional[str] = None


# Control Surface Analysis Models

class FlapConfiguration(BaseModel):
    """Configuration for a trailing edge flap"""
    deflection: float = Field(..., description="Deflection angle in degrees (downwards-positive)")
    hinge_point: float = Field(default=0.75, ge=0.5, le=0.9, description="Hinge location as fraction of chord")


class CSTAnalysisRequest(BaseModel):
    """Request for CST-generated airfoil analysis (no caching)"""
    upper_x: List[float] = Field(..., description="Upper surface X coordinates")
    upper_y: List[float] = Field(..., description="Upper surface Y coordinates")
    lower_x: List[float] = Field(..., description="Lower surface X coordinates")
    lower_y: List[float] = Field(..., description="Lower surface Y coordinates")
    reynolds: float = Field(..., description="Reynolds number")
    mach: float = Field(default=0.0, description="Mach number")
    alpha_start: float = Field(..., description="Alpha start (degrees)")
    alpha_end: float = Field(..., description="Alpha end (degrees)")
    alpha_step: float = Field(..., description="Alpha step (degrees)")
    n_crit: float = Field(default=9.0, description="Critical N-factor")


class NACAAnalysisRequest(BaseModel):
    """Request for NACA-generated airfoil analysis (no caching)"""
    upper_x: List[float] = Field(..., description="Upper surface X coordinates")
    upper_y: List[float] = Field(..., description="Upper surface Y coordinates")
    lower_x: List[float] = Field(..., description="Lower surface X coordinates")
    lower_y: List[float] = Field(..., description="Lower surface Y coordinates")
    reynolds: float = Field(..., description="Reynolds number")
    mach: float = Field(default=0.0, description="Mach number")
    alpha_start: float = Field(..., description="Alpha start (degrees)")
    alpha_end: float = Field(..., description="Alpha end (degrees)")
    alpha_step: float = Field(..., description="Alpha step (degrees)")
    n_crit: float = Field(default=9.0, description="Critical N-factor")
    naca_designation: str = Field(..., description="NACA designation (e.g., 'NACA 2412')")


class TransientAnalysisRequest(BaseModel):
    """Request for transient airfoil analysis (no caching, no database lookup)"""
    upper_x: List[float] = Field(..., description="Upper surface X coordinates")
    upper_y: List[float] = Field(..., description="Upper surface Y coordinates")
    lower_x: List[float] = Field(..., description="Lower surface X coordinates")
    lower_y: List[float] = Field(..., description="Lower surface Y coordinates")
    reynolds: float = Field(..., description="Reynolds number")
    mach: float = Field(default=0.0, description="Mach number")
    alpha_start: float = Field(..., description="Alpha start (degrees)")
    alpha_end: float = Field(..., description="Alpha end (degrees)")
    alpha_step: float = Field(..., description="Alpha step (degrees)")
    n_crit: float = Field(default=9.0, description="Critical N-factor")
    airfoil_name: str = Field(default="Custom Airfoil", description="Display name for the airfoil")


class ControlSurfaceAnalysisRequest(BaseModel):
    """Request for control surface analysis"""
    airfoil_id: str = Field(..., description="Airfoil UUID")
    conditions: AnalysisConditions
    flap_configs: List[FlapConfiguration] = Field(..., min_items=1, max_items=3, description="List of flap configurations (1-3)")


class ControlSurfaceResult(BaseModel):
    """Result for a single flap configuration"""
    deflection: float
    hinge_point: float
    geometry: Dict[str, Any] = Field(..., description="Deflected coordinates (x, y arrays)")
    performance: Dict[str, Any] = Field(..., description="Performance data (alpha, CL, CD, CM arrays)")


class ControlSurfaceAnalysisResponse(BaseModel):
    """Response from control surface analysis"""
    original_airfoil_id: str
    results: List[ControlSurfaceResult] = Field(..., description="Results for each flap configuration")


# Bezier Curve Fitting Models

class BezierFitRequest(BaseModel):
    """Request for Bezier curve fitting"""
    upper_x: List[float] = Field(..., description="Upper surface X coordinates")
    upper_y: List[float] = Field(..., description="Upper surface Y coordinates")
    lower_x: List[float] = Field(..., description="Lower surface X coordinates")
    lower_y: List[float] = Field(..., description="Lower surface Y coordinates")
    order: int = Field(default=6, ge=3, le=10, description="Bezier curve order (3-10)")


class BezierControlPoints(BaseModel):
    """Control points for a single surface"""
    x: List[float] = Field(..., description="X coordinates of control points")
    y: List[float] = Field(..., description="Y coordinates of control points")


class BezierCurveData(BaseModel):
    """Fitted curve data points for plotting"""
    x: List[float] = Field(..., description="X coordinates of curve points")
    y: List[float] = Field(..., description="Y coordinates of curve points")


class BezierFitResponse(BaseModel):
    """Response containing Bezier fit results"""
    upper_control_points: BezierControlPoints
    lower_control_points: BezierControlPoints
    upper_curve: BezierCurveData
    lower_curve: BezierCurveData
    order: int
    upper_sse: float = Field(..., description="Sum of squared errors for upper surface")
    lower_sse: float = Field(..., description="Sum of squared errors for lower surface")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Airfoil Analysis API", "version": "1.0.0"}


@app.get("/health", status_code=200)
@app.head("/health", status_code=200)
async def health():
    """Health check endpoint for monitoring services like Uptime Robot"""
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

            # Check performance_cache for existing results
            if not supabase:
                raise HTTPException(
                    status_code=500,
                    detail="Supabase client not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment variables."
                )
            
            try:
                cache_response = supabase.table('performance_cache').select('*').eq(
                    'airfoil_id', airfoil_id
                ).eq('cond_hash', cond_hash).single().execute()
                
                if cache_response.data:
                    # Return cached results
                    return AnalysisResponse(
                        job_id=None,
                        cached=True,
                        results=cache_response.data['outputs']
                    )
            except Exception as cache_error:
                # Cache miss or error, continue to run analysis
                print(f"Cache lookup failed or miss: {cache_error}")
            
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
                    airfoil_name=airfoil_name,
                    model_size="xlarge"
                )
                # valid model_size: Valid model_size values: "xxsmall" "xsmall" "small" "medium" "large" "xlarge" "xxlarge" "xxxlarge"

                # Store results in performance_cache
                try:
                    cache_data = {
                        'airfoil_id': airfoil_id,
                        'cond_hash': cond_hash,
                        'inputs': request.conditions.model_dump(),
                        'outputs': analysis_results
                    }
                    supabase.table('performance_cache').insert(cache_data).execute()
                except Exception as cache_error:
                    # Log but don't fail if cache storage fails
                    print(f"Failed to cache results: {cache_error}")

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
                
                # === OPTIMIZATION: Batch cache lookup ===
                # Step 1: Pre-generate all condition hashes upfront
                airfoil_hash_map = {}  # airfoil_id -> (airfoil_name, cond_hash)
                for airfoil_id in request.airfoil_ids:
                    airfoil_data = airfoil_map[airfoil_id]
                    airfoil_name = airfoil_data.get('name', f'Airfoil_{airfoil_id[:8]}')
                    cond_hash = generate_condition_hash(request.conditions, airfoil_id)
                    airfoil_hash_map[airfoil_id] = (airfoil_name, cond_hash)
                
                # Step 2: Batch query for all cached results at once
                cache_lookup = {}  # airfoil_id -> cached_outputs
                try:
                    # Fetch all potential cache entries for these airfoils in a single query
                    cache_response = supabase.table('performance_cache').select(
                        'airfoil_id, cond_hash, outputs'
                    ).in_('airfoil_id', list(airfoil_hash_map.keys())).execute()
                    
                    if cache_response.data:
                        # Build a set of expected (airfoil_id, cond_hash) pairs for fast lookup
                        expected_pairs = {
                            (airfoil_id, cond_hash) 
                            for airfoil_id, (_, cond_hash) in airfoil_hash_map.items()
                        }
                        
                        # Filter in-memory to match exact (airfoil_id, cond_hash) pairs
                        for cached_item in cache_response.data:
                            cached_airfoil_id = cached_item['airfoil_id']
                            cached_cond_hash = cached_item['cond_hash']
                            
                            # Check if this matches our required condition hash
                            if (cached_airfoil_id, cached_cond_hash) in expected_pairs:
                                cache_lookup[cached_airfoil_id] = cached_item['outputs']
                
                except Exception as cache_error:
                    print(f"Batch cache lookup failed: {cache_error}")
                    # Continue with empty cache_lookup - will run all analyses
                
                # Step 3: Process each airfoil (now just a map lookup, no DB queries!)
                comparison_results = {}
                n_crit = request.conditions.n_crit if request.conditions.n_crit is not None else 9.0
                
                for airfoil_id in request.airfoil_ids:
                    airfoil_data = airfoil_map[airfoil_id]
                    airfoil_name, cond_hash = airfoil_hash_map[airfoil_id]
                    
                    # Check batch cache lookup
                    if airfoil_id in cache_lookup:
                        # Cache hit!
                        comparison_results[airfoil_name] = cache_lookup[airfoil_id]
                    else:
                        # Cache miss - need to run analysis
                        # Extract coordinates
                        upper_x_coords = airfoil_data['upper_x_coordinates']
                        upper_y_coords = airfoil_data['upper_y_coordinates']
                        lower_x_coords = airfoil_data['lower_x_coordinates']
                        lower_y_coords = airfoil_data['lower_y_coordinates']
                        
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
                        
                        comparison_results[airfoil_name] = analysis_results
                        
                        # Store in cache
                        try:
                            cache_data = {
                                'airfoil_id': airfoil_id,
                                'cond_hash': cond_hash,
                                'inputs': request.conditions.model_dump(),
                                'outputs': analysis_results
                            }
                            supabase.table('performance_cache').insert(cache_data).execute()
                        except Exception as e:
                            print(f"Failed to cache {airfoil_name}: {e}")
                
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


# Airfoil Upload Helper Functions

def calculate_airfoil_properties(upper_surface: List[CoordinatePair], lower_surface: List[CoordinatePair]) -> Dict[str, Any]:
    """
    Helper function to calculate and extract airfoil geometric properties.
    
    Args:
        upper_surface: List of CoordinatePair objects or dicts with x, y keys
        lower_surface: List of CoordinatePair objects or dicts with x, y keys
    
    Returns:
        Dictionary containing calculated properties and extracted coordinates
    """
    # Convert to tuples (handle both CoordinatePair objects and dicts)
    upper = [(p.x if hasattr(p, 'x') else p['x'], p.y if hasattr(p, 'y') else p['y']) for p in upper_surface]
    lower = [(p.x if hasattr(p, 'x') else p['x'], p.y if hasattr(p, 'y') else p['y']) for p in lower_surface]
    
    # Extract coordinates
    coords = extract_coordinates(upper, lower)
    
    # Combine upper and lower surfaces into single x, y arrays
    all_x = [p[0] for p in upper] + [p[0] for p in lower]
    all_y = [p[1] for p in upper] + [p[1] for p in lower]
    
    # Calculate geometric properties using AeroSandbox
    properties = calculate_properties(all_x, all_y)
    
    # Build calculated properties dictionary
    calculated_properties = {
        'thickness_pct': properties['max_thickness'],
        'thickness_loc_pct': properties['max_thickness_location'],
        'camber_pct': properties['max_camber'],
        'camber_loc_pct': properties['max_camber_location'],
        'le_radius': properties['le_radius'],
        'te_thickness': properties['te_thickness'],
        'te_angle': properties['te_angle'],
        'upper_surface_nodes': len(upper),
        'lower_surface_nodes': len(lower),
        **coords,
    }
    
    return calculated_properties


# Airfoil Upload Endpoints

@app.post("/api/airfoils/validate", response_model=AirfoilValidationResponse)
async def validate_airfoil(request: AirfoilValidationRequest):
    """
    Validate airfoil coordinates and calculate geometric properties.
    """
    try:
        errors = []
        # Check name uniqueness
        if supabase:
            try:
                name_check = supabase.table('airfoils').select('id').eq('name', request.name).execute()
                if name_check.data and len(name_check.data) > 0:
                    errors.append(f"Airfoil name '{request.name}' already exists")
            except Exception as e:
                # Log error but don't fail - proceed with validation
                print(f"Name uniqueness check failed: {e}")
                pass
        
        # Validate point counts
        if len(request.upper_surface) == 0:
            errors.append("Upper surface requires at least 1 coordinate pair")
        if len(request.lower_surface) == 0:
            errors.append("Lower surface requires at least 1 coordinate pair")
        
        # Validate maximum point counts
        MAX_POINTS = 200
        if len(request.upper_surface) > MAX_POINTS:
            errors.append(f"Upper surface cannot exceed {MAX_POINTS} points (currently {len(request.upper_surface)})")
        if len(request.lower_surface) > MAX_POINTS:
            errors.append(f"Lower surface cannot exceed {MAX_POINTS} points (currently {len(request.lower_surface)})")
        
        # Validate monotonic x-coordinates
        upper = [tuple(p) for p in request.upper_surface]
        lower = [tuple(p) for p in request.lower_surface]
        
        if len(upper) > 0:
            upper_x = [p[0] for p in upper]
            is_valid, msg = validate_monotonic(upper_x)
            if not is_valid:
                errors.append(f"Upper surface: {msg}")
        
        if len(lower) > 0:
            lower_x = [p[0] for p in lower]
            is_valid, msg = validate_monotonic(lower_x)
            if not is_valid:
                errors.append(f"Lower surface: {msg}")
        
        if errors:
            return AirfoilValidationResponse(valid=False, errors=errors)
        
        # Calculate geometric properties using helper function
        calculated_properties = calculate_airfoil_properties(request.upper_surface, request.lower_surface)
        
        return AirfoilValidationResponse(valid=True, calculated_properties=calculated_properties)
        
    except Exception as e:
        return AirfoilValidationResponse(
            valid=False,
            errors=[f"Validation error: {str(e)}"]
        )


@app.post("/api/airfoils/create", response_model=AirfoilCreateResponse)
async def create_airfoil(request: AirfoilCreateRequest):
    """
    Create a new airfoil in the database.
    """
    try:
        if not supabase:
            return AirfoilCreateResponse(
                success=False,
                error="Database connection not available"
            )
        
        # Validate first
        validation_request = AirfoilValidationRequest(
            name=request.name,
            upper_surface=request.upper_surface,
            lower_surface=request.lower_surface,
        )
        validation = await validate_airfoil(validation_request)
        if not validation.valid:
            return AirfoilCreateResponse(
                success=False,
                error="; ".join(validation.errors or ["Validation failed"])
            )
        
        print("Airfoil validation successful")
        # Calculate geometric properties using helper function
        calculated_properties = calculate_airfoil_properties(request.upper_surface, request.lower_surface)
        
        # Prepare data for insertion
        airfoil_id = str(uuid.uuid4())
        # Normalized name is already alphanumeric only, so no need to replace spaces
        file_path = f"airfoils/{request.name}.dat"
        
        # Handle category - if it's a UUID, fetch the category name, otherwise use as-is
        category_value = None
        if request.category:
            # Check if it's a UUID (category ID)
            try:
                uuid.UUID(request.category)  # Validate UUID format
                # Fetch category name from database
                if supabase:
                    category_response = supabase.table('categories').select('name').eq('id', request.category).single().execute()
                    if category_response.data:
                        category_value = category_response.data.get('name')
            except ValueError:
                # Not a UUID, use as category name directly
                category_value = request.category
        
        airfoil_data = {
            'id': airfoil_id,
            'name': request.name,  # Normalized name (alphanumeric only)
            'display_name': request.display_name or request.name,  # Use display_name if provided, otherwise fallback to name
            'description': request.description,
            'source_url': request.source_url,
            'file_path': file_path,
            **calculated_properties,
        }
        
        # Add category if provided
        if category_value:
            airfoil_data['category'] = category_value
        
        # Insert into database
        response = supabase.table('airfoils').insert(airfoil_data).execute()
        print("Airfoil created successfully")
        if response.data:
            # Use the actual name as the slug (will be URL-encoded by frontend)
            slug = request.name
            return AirfoilCreateResponse(
                success=True,
                airfoil_id=airfoil_id,
                slug=slug
            )
        else:
            return AirfoilCreateResponse(
                success=False,
                error="Failed to insert airfoil into database"
            )
        
    except Exception as e:
        return AirfoilCreateResponse(
            success=False,
            error=f"Error creating airfoil: {str(e)}"
        )


# Control Surface Analysis Endpoint

@app.post("/api/control-surface/analyze", response_model=ControlSurfaceAnalysisResponse)
async def analyze_control_surface(request: ControlSurfaceAnalysisRequest):
    """
    Analyze airfoil with trailing edge flap deflections.
    For each flap configuration, checks cache first, then generates deflected geometry
    and runs analysis if needed.
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=500,
                detail="Supabase client not configured"
            )
        
        # Fetch original airfoil coordinates
        airfoil_response = supabase.table('airfoils').select(
            'id, name, upper_x_coordinates, upper_y_coordinates, lower_x_coordinates, lower_y_coordinates'
        ).eq('id', request.airfoil_id).single().execute()
        
        if not airfoil_response.data:
            raise HTTPException(status_code=404, detail=f"Airfoil with ID {request.airfoil_id} not found")
        
        airfoil_data = airfoil_response.data
        original_upper_x = airfoil_data['upper_x_coordinates']
        original_upper_y = airfoil_data['upper_y_coordinates']
        original_lower_x = airfoil_data['lower_x_coordinates']
        original_lower_y = airfoil_data['lower_y_coordinates']
        airfoil_name = airfoil_data.get('name', 'Airfoil')
        
        # Combine original coordinates for deflection
        original_x = original_upper_x + original_lower_x
        original_y = original_upper_y + original_lower_y
        
        results = []
        
        # Process each flap configuration
        for flap_config in request.flap_configs:
            deflection = flap_config.deflection
            hinge_point = flap_config.hinge_point
            
            # When deflection is 0, use control_surface_fraction = 0 (hinge point doesn't matter)
            flap_fraction_for_hash = 0.0 if deflection == 0 else hinge_point
            
            # Generate hash including flap parameters
            cond_hash = generate_condition_hash(
                request.conditions,
                request.airfoil_id,
                flap_fraction=flap_fraction_for_hash,
                deflection=deflection
            )
            
            # Check cache first
            cached_result = None
            try:
                cache_response = supabase.table('performance_cache').select('*').eq(
                    'airfoil_id', request.airfoil_id
                ).eq('cond_hash', cond_hash).execute()
                
                if cache_response.data and len(cache_response.data) > 0:
                    cached_result = cache_response.data[0]
            except Exception as cache_error:
                print(f"Cache lookup failed: {cache_error}")
            
            if cached_result:
                # Use cached performance data
                performance_data = cached_result['outputs']
                
                # Need to regenerate geometry for cached results
                if deflection == 0:
                    # Original airfoil - use original coordinates
                    deflected_x = original_x
                    deflected_y = original_y
                else:
                    # Regenerate deflected geometry
                    deflected_coords = deflect_trailing_edge_flap(
                        original_x, original_y, deflection, hinge_point
                    )
                    deflected_x = deflected_coords['x']
                    deflected_y = deflected_coords['y']
                
                # Split back into upper and lower
                # Find leading edge (minimum x)
                min_x_idx = deflected_x.index(min(deflected_x))
                upper_x = deflected_x[:min_x_idx + 1]
                upper_y = deflected_y[:min_x_idx + 1]
                lower_x = deflected_x[min_x_idx + 1:]
                lower_y = deflected_y[min_x_idx + 1:]
                
                geometry = {
                    'upper_x': upper_x,
                    'upper_y': upper_y,
                    'lower_x': lower_x,
                    'lower_y': lower_y,
                }
            else:
                # Cache miss - need to deflect and analyze
                if deflection == 0:
                    # Original airfoil - use original coordinates
                    deflected_x = original_x
                    deflected_y = original_y
                    upper_x = original_upper_x
                    upper_y = original_upper_y
                    lower_x = original_lower_x
                    lower_y = original_lower_y
                else:
                    # Deflect the airfoil
                    deflected_coords = deflect_trailing_edge_flap(
                        original_x, original_y, deflection, hinge_point
                    )
                    deflected_x = deflected_coords['x']
                    deflected_y = deflected_coords['y']
                    
                    # Split back into upper and lower surfaces
                    # Find leading edge (minimum x)
                    min_x_idx = deflected_x.index(min(deflected_x))
                    upper_x = deflected_x[:min_x_idx + 1]
                    upper_y = deflected_y[:min_x_idx + 1]
                    lower_x = deflected_x[min_x_idx + 1:]
                    lower_y = deflected_y[min_x_idx + 1:]
                
                geometry = {
                    'upper_x': upper_x,
                    'upper_y': upper_y,
                    'lower_x': lower_x,
                    'lower_y': lower_y,
                }
                
                # Run analysis with deflected coordinates
                performance_data = analyze_airfoil(
                    upper_x_coords=upper_x,
                    upper_y_coords=upper_y,
                    lower_x_coords=lower_x,
                    lower_y_coords=lower_y,
                    reynolds_number=request.conditions.Re,
                    mach_number=request.conditions.Mach,
                    alpha_range=request.conditions.alpha_range,
                    n_crit=request.conditions.n_crit if request.conditions.n_crit is not None else 9.0,
                    airfoil_name=airfoil_name
                )
                
                # Cache the results
                try:
                    cache_data = {
                        'airfoil_id': request.airfoil_id,
                        'cond_hash': cond_hash,
                        'inputs': {
                            **request.conditions.model_dump(),
                            'flap_fraction': flap_fraction_for_hash,  # Use 0 when deflection is 0
                            'deflection': deflection
                        },
                        'outputs': performance_data
                    }
                    supabase.table('performance_cache').insert(cache_data).execute()
                except Exception as cache_error:
                    print(f"Failed to cache results: {cache_error}")
            
            results.append(ControlSurfaceResult(
                deflection=deflection,
                hinge_point=hinge_point,
                geometry=geometry,
                performance=performance_data
            ))
        
        return ControlSurfaceAnalysisResponse(
            original_airfoil_id=request.airfoil_id,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing control surface: {str(e)}"
        )


@app.post("/api/analyze-transient")
async def analyze_transient(request: TransientAnalysisRequest):
    """
    Analyze transient airfoil coordinates directly (no caching, no database lookup).
    This unified endpoint is for CST, NACA, or any custom airfoil that shouldn't be cached.
    """
    try:
        # Validate coordinate arrays
        if len(request.upper_x) != len(request.upper_y):
            raise HTTPException(
                status_code=400,
                detail="Upper X and Y coordinate arrays must have the same length"
            )
        if len(request.lower_x) != len(request.lower_y):
            raise HTTPException(
                status_code=400,
                detail="Lower X and Y coordinate arrays must have the same length"
            )
        if len(request.upper_x) < 2 or len(request.lower_x) < 2:
            raise HTTPException(
                status_code=400,
                detail="Need at least 2 points for upper and lower surfaces"
            )
        
        # Validate alpha range
        if request.alpha_start >= request.alpha_end:
            raise HTTPException(
                status_code=400,
                detail="alpha_start must be less than alpha_end"
            )
        if request.alpha_step <= 0:
            raise HTTPException(
                status_code=400,
                detail="alpha_step must be positive"
            )
        
        # Run analysis directly (no caching)
        analysis_results = analyze_airfoil(
            upper_x_coords=request.upper_x,
            upper_y_coords=request.upper_y,
            lower_x_coords=request.lower_x,
            lower_y_coords=request.lower_y,
            reynolds_number=request.reynolds,
            mach_number=request.mach,
            alpha_range=[request.alpha_start, request.alpha_end, request.alpha_step],
            n_crit=request.n_crit,
            airfoil_name=request.airfoil_name,
            model_size="xlarge"
        )
        
        return analysis_results
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing airfoil: {str(e)}"
        )


@app.post("/api/analyze-cst")
async def analyze_cst(request: CSTAnalysisRequest):
    """
    Analyze CST-generated airfoil coordinates directly (no caching, no database lookup).
    Legacy endpoint - redirects to analyze-transient for backward compatibility.
    """
    transient_request = TransientAnalysisRequest(
        upper_x=request.upper_x,
        upper_y=request.upper_y,
        lower_x=request.lower_x,
        lower_y=request.lower_y,
        reynolds=request.reynolds,
        mach=request.mach,
        alpha_start=request.alpha_start,
        alpha_end=request.alpha_end,
        alpha_step=request.alpha_step,
        n_crit=request.n_crit,
        airfoil_name="CST Airfoil"
    )
    return await analyze_transient(transient_request)


@app.post("/api/analyze-naca")
async def analyze_naca(request: NACAAnalysisRequest):
    """
    Analyze NACA-generated airfoil coordinates directly (no caching, no database lookup).
    Legacy endpoint - redirects to analyze-transient for backward compatibility.
    """
    transient_request = TransientAnalysisRequest(
        upper_x=request.upper_x,
        upper_y=request.upper_y,
        lower_x=request.lower_x,
        lower_y=request.lower_y,
        reynolds=request.reynolds,
        mach=request.mach,
        alpha_start=request.alpha_start,
        alpha_end=request.alpha_end,
        alpha_step=request.alpha_step,
        n_crit=request.n_crit,
        airfoil_name=request.naca_designation
    )
    return await analyze_transient(transient_request)


@app.post("/api/bezier-fit", response_model=BezierFitResponse)
async def bezier_fit(request: BezierFitRequest):
    """
    Fit Bezier curves to airfoil coordinates.
    Returns control points and fitted curve data for upper and lower surfaces.
    """
    try:
        # Validate coordinate arrays
        if len(request.upper_x) != len(request.upper_y):
            raise HTTPException(
                status_code=400,
                detail="Upper X and Y coordinate arrays must have the same length"
            )
        if len(request.lower_x) != len(request.lower_y):
            raise HTTPException(
                status_code=400,
                detail="Lower X and Y coordinate arrays must have the same length"
            )
        if len(request.upper_x) < 2 or len(request.lower_x) < 2:
            raise HTTPException(
                status_code=400,
                detail="Need at least 2 points for upper and lower surfaces"
            )

        # Initialize fitter with requested order
        fitter = BezierFitter(order=request.order)

        # Fit curves to both surfaces
        result = fitter.fit(
            upper_x=request.upper_x,
            upper_y=request.upper_y,
            lower_x=request.lower_x,
            lower_y=request.lower_y
        )

        # Build response
        return BezierFitResponse(
            upper_control_points=BezierControlPoints(
                x=result['upper_control_points'][:, 0].tolist(),
                y=result['upper_control_points'][:, 1].tolist()
            ),
            lower_control_points=BezierControlPoints(
                x=result['lower_control_points'][:, 0].tolist(),
                y=result['lower_control_points'][:, 1].tolist()
            ),
            upper_curve=BezierCurveData(
                x=result['upper_curve'][:, 0].tolist(),
                y=result['upper_curve'][:, 1].tolist()
            ),
            lower_curve=BezierCurveData(
                x=result['lower_curve'][:, 0].tolist(),
                y=result['lower_curve'][:, 1].tolist()
            ),
            order=result['order'],
            upper_sse=result['upper_sse'],
            lower_sse=result['lower_sse']
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Bezier fitting failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


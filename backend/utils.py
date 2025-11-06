"""
Utility functions for the airfoil analysis backend.
"""
import hashlib
import json
from typing import Dict, Any
from pydantic import BaseModel


def generate_condition_hash(conditions: BaseModel, airfoil_id: str) -> str:
    """
    Generate a SHA256 hash of analysis conditions and airfoil ID for cache lookup.
    
    Args:
        conditions: Pydantic model with analysis conditions
        airfoil_id: Single airfoil UUID
        
    Returns:
        Hex string hash of the conditions and airfoil ID
    """
    conditions_dict = conditions.model_dump(exclude_none=True, mode='json')
    
    # Include airfoil ID in the hash
    hash_data = {
        'conditions': conditions_dict,
        'airfoil_id': airfoil_id
    }
    
    hash_str = json.dumps(hash_data, sort_keys=True)
    return hashlib.sha256(hash_str.encode()).hexdigest()


def validate_alpha_range(alpha_range: list) -> bool:
    """
    Validate that alpha_range is in correct format: [start, end, step].
    
    Args:
        alpha_range: List with [start, end, step]
        
    Returns:
        True if valid, False otherwise
    """
    if not isinstance(alpha_range, list) or len(alpha_range) != 3:
        return False
    
    start, end, step = alpha_range
    
    if not all(isinstance(x, (int, float)) for x in [start, end, step]):
        return False
    
    if step <= 0:
        return False
    
    if start >= end:
        return False
    
    return True


def format_alpha_schedule(alpha_range: list) -> list:
    """
    Convert alpha_range [start, end, step] to a list of alpha values.
    
    Args:
        alpha_range: [start, end, step]
        
    Returns:
        List of alpha values
    """
    start, end, step = alpha_range
    return [round(start + i * step, 2) for i in range(int((end - start) / step) + 1)]


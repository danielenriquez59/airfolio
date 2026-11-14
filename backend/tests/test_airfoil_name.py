"""The stored airfoil name must stay lower-case and address-safe. Run from backend/: python -m pytest tests/test_airfoil_name.py"""
import pytest
from pydantic import ValidationError

from main import AirfoilCreateRequest

SURF = [{'x': 0, 'y': 0}, {'x': 1, 'y': 0}]


@pytest.mark.parametrize('name', ['naca2412', 'e387', 'ag-35_v2.1'])
def test_safe_name_accepted(name):
    assert AirfoilCreateRequest(name=name, upper_surface=SURF, lower_surface=SURF).name == name


@pytest.mark.parametrize('name', ['', 'NACA2412', 'naca 2412', 'a,b', 'a&b', 'a/b', 'café'])
def test_unsafe_name_rejected(name):
    with pytest.raises(ValidationError):
        AirfoilCreateRequest(name=name, upper_surface=SURF, lower_surface=SURF)


@pytest.mark.parametrize('display_name', [None, 'NACA-2412', 'My Foil 1.2_b'])
def test_display_name_accepted(display_name):
    req = AirfoilCreateRequest(name='naca2412', display_name=display_name, upper_surface=SURF, lower_surface=SURF)
    assert req.display_name == display_name


@pytest.mark.parametrize('display_name', ['', 'DP1,68-8,37', 'a&b', 'foil/2', 'é387', 'foil (v2)'])
def test_display_name_special_characters_rejected(display_name):
    with pytest.raises(ValidationError):
        AirfoilCreateRequest(name='naca2412', display_name=display_name, upper_surface=SURF, lower_surface=SURF)

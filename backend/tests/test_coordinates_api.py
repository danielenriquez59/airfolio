"""Public coordinates endpoint, the daily upload cap, deleting own uploads, upload validation and /api/analyze, called directly (the pinned FastAPI test client does not work with the pinned httpx). Run from backend/: python -m pytest tests/test_coordinates_api.py"""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import main
from utils import selig_loop

UUID = '5c9910e3-a327-42c6-98ca-2a14b8ea0d7b'
AIRFOIL = {
    'id': UUID,
    'name': 'testfoil',
    # Stored both surfaces LE to TE, as an upload may leave them
    'upper_x_coordinates': [0.0, 0.5, 1.0],
    'upper_y_coordinates': [0.0, 0.1, 0.0],
    'lower_x_coordinates': [0.0, 0.5, 1.0],
    'lower_y_coordinates': [0.0, -0.05, 0.0],
}


class FakeSupabase:
    """Records the filter used and returns the rows it was given."""

    def __init__(self, rows, count=None):
        self.rows, self.count, self.filter, self.tables, self.deleted = rows, count, None, [], False

    def table(self, name):
        self.tables.append(name)
        return self

    def select(self, _cols, **_kwargs):
        return self

    def gte(self, _column, _value):
        return self

    def delete(self):
        self.deleted = True
        return self

    def eq(self, column, value):
        self.filter = (column, value)
        return self

    def limit(self, _n):
        return self

    def in_(self, _column, _values):
        return self

    def upsert(self, rows, **_kwargs):
        self.upserted = rows
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows, count=self.count)


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase([AIRFOIL])
    monkeypatch.setattr(main, 'supabase', fake)
    return fake


def test_selig_loop_runs_upper_te_to_lower_te_with_one_nose_point():
    points = selig_loop([(0.0, 0.0), (0.5, 0.1), (1.0, 0.0)], [(0.0, 0.0), (0.5, -0.05), (1.0, 0.0)])
    assert points == [[1.0, 0.0], [0.5, 0.1], [0.0, 0.0], [0.5, -0.05], [1.0, 0.0]]


def test_lookup_by_name_is_case_insensitive(db):
    res = main.get_airfoil_coordinates('TestFoil')
    assert db.filter == ('name', 'testfoil')
    assert res['name'] == 'testfoil' and res['id'] == UUID
    assert res['coordinates'][0] == [1.0, 0.0] and len(res['coordinates']) == 5


def test_lookup_by_id(db):
    main.get_airfoil_coordinates(UUID.upper())
    assert db.filter == ('id', UUID)


def test_unknown_airfoil_is_404(db):
    db.rows = []
    with pytest.raises(HTTPException) as err:
        main.get_airfoil_coordinates('nope')
    assert err.value.status_code == 404


def test_rate_limit_is_per_ip(monkeypatch):
    monkeypatch.setattr(main, 'PUBLIC_API_LIMIT', 2)
    monkeypatch.setattr(main.time, 'time', lambda: 1_000_000.0)  # keep every call in one minute
    main._rate_hits.clear()

    def call(ip):
        asyncio.run(main.rate_limit(SimpleNamespace(headers={'x-forwarded-for': ip}, client=None)))

    call('1.1.1.1')
    call('1.1.1.1')
    with pytest.raises(HTTPException) as err:
        call('1.1.1.1')
    assert err.value.status_code == 429 and err.value.headers['Retry-After']
    call('2.2.2.2')  # another client is not blocked


SURF = [{'x': 0, 'y': 0}, {'x': 1, 'y': 0}]


def test_upload_blocked_at_daily_limit_for_non_admin(monkeypatch):
    fake = FakeSupabase([], count=main.UPLOADS_PER_DAY)  # no admins row, limit already used
    monkeypatch.setattr(main, 'supabase', fake)
    req = main.AirfoilCreateRequest(name='newfoil', upper_surface=SURF, lower_surface=SURF)
    res = main.create_airfoil(req, user_id=UUID)
    assert res.success is False and 'limited uploads' in res.error
    assert fake.tables == ['airfoil_uploads', 'admins']  # stopped before touching airfoils


def test_upload_limit_does_not_block_admin_or_under_limit(monkeypatch):
    for fake in (FakeSupabase([{'user_id': UUID}], count=99), FakeSupabase([], count=main.UPLOADS_PER_DAY - 1)):
        monkeypatch.setattr(main, 'supabase', fake)
        req = main.AirfoilCreateRequest(name='newfoil', upper_surface=SURF, lower_surface=SURF)
        res = main.create_airfoil(req, user_id=UUID)
        assert 'limited uploads' not in (res.error or '')


def test_validate_rejects_a_repeated_point(monkeypatch):
    monkeypatch.setattr(main, 'supabase', FakeSupabase([]))  # name not taken
    upper = [{'x': 1, 'y': 0}, {'x': 0.5, 'y': 0.1}, {'x': 0.5, 'y': 0.1}, {'x': 0, 'y': 0}]
    res = main.validate_airfoil(main.AirfoilValidationRequest(name='dup', upper_surface=upper, lower_surface=SURF))
    assert res.valid is False
    assert res.errors == ['Upper surface: X-coordinates must be monotonic (either all increasing or all decreasing)']


def test_analyze_returns_the_polar_for_one_id_and_polars_by_name_for_several(monkeypatch):
    other = {**AIRFOIL, 'id': 'other-id', 'name': 'otherfoil'}
    fake = FakeSupabase([AIRFOIL, other])  # the fake's cache rows lack cond_hash, so every airfoil is a miss
    monkeypatch.setattr(main, 'supabase', fake)
    monkeypatch.setattr(main, 'analyze_airfoil', lambda **kw: {'CL': [kw['airfoil_name']]})
    cond = {'Re': 1e5, 'alpha_range': [0, 1, 1]}

    one = main.analyze(main.AnalysisRequest(airfoil_ids=[UUID], conditions=cond))
    assert one.results == {'CL': ['testfoil']}
    assert [row['airfoil_id'] for row in fake.upserted] == [UUID]

    two = main.analyze(main.AnalysisRequest(airfoil_ids=[UUID, 'other-id'], conditions=cond))
    assert two.results == {'testfoil': {'CL': ['testfoil']}, 'otherfoil': {'CL': ['otherfoil']}}


def test_cannot_delete_an_airfoil_someone_else_uploaded(monkeypatch):
    fake = FakeSupabase([])  # no uploader record for this user and airfoil
    monkeypatch.setattr(main, 'supabase', fake)
    with pytest.raises(HTTPException) as err:
        main.delete_own_airfoil(main.uuid.UUID(UUID), user_id='someone-else')
    assert err.value.status_code == 404
    assert fake.tables == ['airfoil_uploads'] and not fake.deleted


@pytest.mark.parametrize('overrides', [
    {'alpha_start': -10, 'alpha_end': 10, 'alpha_step': 0.1},  # 201 angles
    {'upper_x': [0.0] * 1001, 'upper_y': [0.0] * 1001},
])
def test_transient_analysis_refuses_oversized_requests(monkeypatch, overrides):
    monkeypatch.setattr(main, 'analyze_airfoil', lambda **_: pytest.fail('analysis ran'))
    body = {'upper_x': [1.0, 0.0], 'upper_y': [0.0, 0.0], 'lower_x': [0.0, 1.0], 'lower_y': [0.0, 0.0],
            'reynolds': 1e5, 'alpha_start': -5, 'alpha_end': 20, 'alpha_step': 0.5, **overrides}
    with pytest.raises(HTTPException) as err:
        main.analyze_transient(main.TransientAnalysisRequest(**body))
    assert err.value.status_code == 400 and 'at most' in err.value.detail.lower()


def test_uploader_can_delete_their_airfoil(monkeypatch):
    fake = FakeSupabase([{'airfoil_id': UUID}])
    monkeypatch.setattr(main, 'supabase', fake)
    assert main.delete_own_airfoil(main.uuid.UUID(UUID), user_id='me') == {'success': True}
    assert fake.tables == ['airfoil_uploads', 'airfoils'] and fake.deleted and fake.filter == ('id', UUID)

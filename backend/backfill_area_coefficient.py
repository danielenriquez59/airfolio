"""
One-time backfill of airfoils.area_coefficient from stored coordinates.

Run only after the nullable area_coefficient column exists:

    python backfill_area_coefficient.py
"""
from config import settings
from supabase import create_client
from utils import calculate_area_coefficient, orient_airfoil_surfaces


BATCH_SIZE = 100


def _pairs(xs, ys):
    """Zip coordinate arrays, or return an empty polygon when they do not match."""
    if not xs or not ys or len(xs) != len(ys):
        return []
    return list(zip(xs, ys))


def backfill_area_coefficients() -> None:
    """Update only area_coefficient for every airfoil that has a valid polygon."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")

    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    client.table("airfoils").select("area_coefficient").limit(1).execute()
    updated = 0
    skipped = 0
    failed = 0
    offset = 0

    while True:
        response = (
            client.table("airfoils")
            .select(
                "id, upper_x_coordinates, upper_y_coordinates, "
                "lower_x_coordinates, lower_y_coordinates"
            )
            .order("id")
            .range(offset, offset + BATCH_SIZE - 1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break

        for row in rows:
            try:
                upper = _pairs(row.get("upper_x_coordinates"), row.get("upper_y_coordinates"))
                lower = _pairs(row.get("lower_x_coordinates"), row.get("lower_y_coordinates"))
                upper, lower = orient_airfoil_surfaces(upper, lower)
                xs = [point[0] for point in upper] + [point[0] for point in lower]
                ys = [point[1] for point in upper] + [point[1] for point in lower]
                area = calculate_area_coefficient(xs, ys)
                if area is None:
                    skipped += 1
                    print(f"skipped {row.get('id')}: invalid polygon")
                    continue

                client.table("airfoils").update({"area_coefficient": area}).eq("id", row["id"]).execute()
                updated += 1
            except Exception as error:
                failed += 1
                print(f"failed {row.get('id')}: {error}")

        offset += len(rows)
        print(f"progress offset={offset} updated={updated} skipped={skipped} failed={failed}")

    print(f"updated={updated} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    backfill_area_coefficients()

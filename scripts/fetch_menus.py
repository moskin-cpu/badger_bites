#!/usr/bin/env python3
"""Build a small static snapshot from UW Housing Dining's Nutrislice menus."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

API_ROOT = "https://wisc-housingdining.api.nutrislice.com"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT_ROOT / "data" / "menus.json"
MEALS = ("breakfast", "lunch", "dinner")
MENU_TYPE_IDS = {"breakfast": 14942, "lunch": 14943, "dinner": 14944}
FALLBACK_MARKETS = (
    {
        "id": 45373,
        "name": "Carson's Market",
        "slug": "carsons-market",
        "address": "Carson Gulley Center · 1515 Tripp Cir.",
        "latitude": 43.07715570280584,
        "longitude": -89.41134061885892,
    },
    {
        "id": 45374,
        "name": "Liz's Market",
        "slug": "lizs-market",
        "address": "Waters Residence Hall · 1200 Observatory Dr.",
        "latitude": 43.07694917047651,
        "longitude": -89.40694288799442,
    },
)


def get_json(url: str):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "Badger-Bites-GitHub-Pages/1.0"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def dated_path(template: str, target: date) -> str:
    return (
        template.replace("{year}", f"{target.year:04d}")
        .replace("{month}", f"{target.month:02d}")
        .replace("{day}", f"{target.day:02d}")
    )


def menu_types_for_school(school_id: int) -> list[dict]:
    return [
        {
            "slug": meal,
            "urls": {
                "full_menu_by_date_api_url_template": (
                    f"/menu/api/weeks/school/{school_id}/menu-type/{menu_type_id}/"
                    "{year}/{month}/{day}"
                )
            },
        }
        for meal, menu_type_id in MENU_TYPE_IDS.items()
    ]


def simplify_day(raw_day: dict) -> list[dict]:
    menu_info = raw_day.get("menu_info") or {}
    seen: set[str] = set()
    result = []
    for entry in raw_day.get("menu_items") or []:
        food = entry.get("food")
        if not food or not food.get("name"):
            continue
        name = food["name"].strip()
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        icons = ((food.get("icons") or {}).get("food_icons") or [])
        nutrition = food.get("rounded_nutrition_info") or {}
        menu_id = str(entry.get("menu_id") or "")
        section = (((menu_info.get(menu_id) or {}).get("section_options") or {}).get("display_name") or "Daily menu")
        result.append(
            {
                "id": str(entry.get("id") or f"{key}-{len(result)}"),
                "name": name,
                "description": food.get("description") or "",
                "category": food.get("food_category") or "",
                "section": section,
                "calories": nutrition.get("calories"),
                "protein": nutrition.get("g_protein"),
                "allergens": [icon.get("slug") for icon in icons if icon.get("behavior") == 1 and icon.get("slug")],
                "traits": [icon.get("slug") for icon in icons if icon.get("behavior") != 1 and icon.get("slug")],
            }
        )
    return result


def main() -> None:
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    earliest_day = today - timedelta(days=3)
    last_day = today + timedelta(days=13)
    schools = get_json(f"{API_ROOT}/menu/api/schools/")
    locations = []

    active_slugs = {school["slug"] for school in schools}
    active_names = {school["name"].casefold() for school in schools}
    for market in FALLBACK_MARKETS:
        if market["slug"] not in active_slugs and market["name"].casefold() not in active_names:
            schools.append({**market, "active_menu_types": menu_types_for_school(market["id"])})

    for school in schools:
        geolocation = school.get("geolocation") or {}
        location = {
            "id": school["id"],
            "name": school["name"],
            "slug": school["slug"],
            "address": school.get("address") or "UW–Madison campus",
            "latitude": school.get("latitude") or geolocation.get("latitude"),
            "longitude": school.get("longitude") or geolocation.get("longitude"),
            "menus": {},
        }
        menu_types = {item.get("slug"): item for item in school.get("active_menu_types") or []}
        for week_start in (earliest_day, earliest_day + timedelta(days=7), earliest_day + timedelta(days=14)):
            for meal in MEALS:
                menu_type = menu_types.get(meal)
                if not menu_type:
                    continue
                template = (menu_type.get("urls") or {}).get("full_menu_by_date_api_url_template")
                if not template:
                    continue
                try:
                    payload = get_json(f"{API_ROOT}{dated_path(template, week_start)}")
                except (OSError, ValueError) as error:
                    print(f"Could not load {school['name']} {meal}: {error}")
                    continue
                for raw_day in payload.get("days") or []:
                    day_value = raw_day.get("date")
                    if not day_value:
                        continue
                    parsed = date.fromisoformat(day_value)
                    if earliest_day <= parsed <= last_day:
                        location["menus"].setdefault(day_value, {})[meal] = simplify_day(raw_day)
        locations.append(location)

    dates = sorted({day for location in locations for day in location["menus"]})
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "firstDate": today.isoformat(),
        "earliestDate": earliest_day.isoformat(),
        "lastDate": last_day.isoformat(),
        "dates": dates,
        "locations": locations,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(locations)} locations and {len(dates)} dates to {OUTPUT}")


if __name__ == "__main__":
    main()

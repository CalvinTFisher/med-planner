# app_integrations.py
import httpx, re
import xmltodict
from typing import List, Dict, Any, Optional

RXNAV = "https://rxnav.nlm.nih.gov/REST"
DAILYMED = "https://dailymed.nlm.nih.gov/dailymed/services/v2"

async def rxnorm_find_rxcui_by_string(session: httpx.AsyncClient, name: str) -> Optional[str]:
    # Good normalizer (supports approx & normalized matching)
    # Docs: findRxcuiByString, getDrugs, etc.
    # https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
    r = await session.get(f"{RXNAV}/rxcui.json", params={"name": name})
    r.raise_for_status()
    data = r.json()
    ids = data.get("idGroup", {}).get("rxnormId")
    return ids[0] if ids else None

async def dailymed_search_spls_by_drugname(session: httpx.AsyncClient, name: str) -> List[Dict[str, Any]]:
    # DailyMed v2 resources list: /spls is the listing endpoint
    # Base: https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json
    # We'll filter by drug_name; DailyMed supports multiple filters (see docs page).
    r = await session.get(f"{DAILYMED}/spls.json", params={"drug_name": name, "pagesize": 3})
    r.raise_for_status()
    return r.json().get("data", []) or []

async def dailymed_fetch_spl_by_setid(session: httpx.AsyncClient, setid: str) -> Dict[str, Any]:
    r = await session.get(f"{DAILYMED}/spls/{setid}.xml")
    r.raise_for_status()
    return xmltodict.parse(r.text)

def extract_label_hints(label_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse SPL sections for practical hints:
      - with_food (bool/unknown)
      - avoid_coadmin (list of keywords: antacids, iron, calcium…)
      - preferred_times (morning/evening/bedtime)
    This is heuristic text-mining and should be shown with a disclaimer.
    """
    def flatten(obj):
        if isinstance(obj, dict):
            return " ".join(flatten(v) for v in obj.values())
        if isinstance(obj, list):
            return " ".join(flatten(v) for v in obj)
        return str(obj) if obj is not None else ""

    text_blob = flatten(label_dict).lower()

    import re
    with_food = bool(re.search(r"(take with food|with meals|administer with food)", text_blob))
    empty_stomach = bool(re.search(r"(empty stomach|1 hour before|2 hours after meals)", text_blob))
    bedtime = bool(re.search(r"\bbedtime\b", text_blob))
    morning = bool(re.search(r"\bmorning\b", text_blob))

    avoid_list = []
    for k in ["antacids", "calcium", "iron", "magnesium", "dairy", "grapefruit"]:
        if k in text_blob:
            avoid_list.append(k)

    return {
        "with_food_hint": with_food and not empty_stomach,
        "empty_stomach_hint": empty_stomach,
        "preferred_time_hint": "bedtime" if bedtime else ("morning" if morning else None),
        "avoid_coadmin_keywords": avoid_list,
    }

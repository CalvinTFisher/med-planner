from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Literal
import httpx
from app_integrations import (
    rxnorm_find_rxcui_by_string, dailymed_search_spls_by_drugname,
    dailymed_fetch_spl_by_setid, extract_label_hints
)

# --------- Models (mirror your TS types) ----------
Unit = Literal["mg", "mcg", "g", "mL", "tabs", "caps"]
Form = Literal["tablet", "capsule", "liquid", "injection", "other"]
Frequency = Literal["qd", "bid", "tid", "qid", "qod", "prn"]
Sex = Literal["male", "female", "other"]

class Medication(BaseModel):
    id: str
    name: str
    dose: str
    unit: Unit
    form: Form
    frequency: Frequency
    withFood: bool
    notes: str | None = None

class Patient(BaseModel):
    age: int | None = None
    sex: Sex | None = None
    weightKg: float | None = None
    pregnant: bool | None = None
    breastfeeding: bool | None = None
    conditions: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)

class InteractionsRequest(BaseModel):
    meds: List[Medication]
    patient: Patient

class Finding(BaseModel):
    a: str
    b: str
    severity: Literal["Avoid", "Caution", "None"]
    reason: str

class InteractionsResponse(BaseModel):
    findings: List[Finding]

class MedicationIn(BaseModel):
    id: str
    name: str
    dose: str
    unit: Literal["mg","mcg","g","mL","tabs","caps"]
    form: Literal["tablet","capsule","liquid","injection","other"]
    frequency: Literal["qd","bid","tid","qid","qod","prn"]
    withFood: bool
    notes: str | None = None

class PatientIn(BaseModel):
    age: int | None = None
    sex: Literal["male","female","other"] | None = None
    weightKg: float | None = None
    pregnant: bool | None = None
    breastfeeding: bool | None = None
    conditions: List[str] = []
    allergies: List[str] = []

class NormalizeOut(BaseModel):
    name: str
    rxcui: str | None

class LabelHintsOut(BaseModel):
    name: str
    setid: str | None
    hints: dict


# --------- Demo rules (swap with real data later) ----------
DEMO_RULES = [
    (["ibuprofen", "naproxen"], "Avoid", "Two NSAIDs increase GI/renal risk without added benefit."),
    (["simvastatin", "clarithromycin"], "Avoid", "Clarithromycin inhibits metabolism of simvastatin → rhabdomyolysis risk."),
    (["warfarin", "ibuprofen"], "Caution", "Bleeding risk increases. Monitor INR and avoid long-term combo."),
    (["metformin", "cimetidine"], "Caution", "May increase metformin levels. Monitor for GI/lactic acidosis risk."),
]

def classify(a: str, b: str):
    aL, bL = a.strip().lower(), b.strip().lower()
    for pair, severity, reason in DEMO_RULES:
        x, y = pair
        if (x in aL and y in bL) or (x in bL and y in aL):
            return severity, reason
    return "None", "No known interaction from demo rules."

# --------- App ----------
app = FastAPI(title="Med Interactions API", version="0.1.0")

# Allow your React dev server + your prod origin(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/interactions", response_model=InteractionsResponse)
def interactions(payload: InteractionsRequest):
    meds = payload.meds
    findings: list[Finding] = []
    for i in range(len(meds)):
        for j in range(i+1, len(meds)):
            a, b = meds[i].name, meds[j].name
            sev, reason = classify(a, b)
            findings.append(Finding(a=a, b=b, severity=sev, reason=reason))
    # You could enrich with patient context here (pregnancy, renal/hepatic flags, etc.)
    return InteractionsResponse(findings=findings)

@app.post("/api/normalize", response_model=List[NormalizeOut])
async def normalize(meds: List[str]):
    async with httpx.AsyncClient(timeout=15) as s:
        out = []
        for m in meds:
            rxcui = await rxnorm_find_rxcui_by_string(s, m)
            out.append(NormalizeOut(name=m, rxcui=rxcui))
        return out

@app.post("/api/label_sections", response_model=List[LabelHintsOut])
async def label_sections(meds: List[str]):
    async with httpx.AsyncClient(timeout=20) as s:
        results: List[LabelHintsOut] = []
        for m in meds:
            lst = await dailymed_search_spls_by_drugname(s, m)
            setid = lst[0]["setid"] if lst else None
            hints = {}
            if setid:
                spl = await dailymed_fetch_spl_by_setid(s, setid)
                hints = extract_label_hints(spl)
            results.append(LabelHintsOut(name=m, setid=setid, hints=hints))
        return results

class PlanRequest(BaseModel):
    meds: List[MedicationIn]
    patient: PatientIn

class DoseSlot(BaseModel):
    time: str           # "08:00"
    with_food: bool | None = None
    notes: List[str] = []

class PlanItem(BaseModel):
    med_id: str
    med_name: str
    slots: List[DoseSlot]

class PlanResponse(BaseModel):
    items: List[PlanItem]
    caveats: List[str]

FREQ_TO_TIMES = {
    "qd": ["08:00"],
    "bid": ["08:00", "20:00"],
    "tid": ["08:00", "14:00", "20:00"],
    "qid": ["06:00","12:00","18:00","22:00"],
    "qod": ["08:00 (alt days)"],
    "prn": ["As needed"],
}

@app.post("/api/plan", response_model=PlanResponse)
async def plan(payload: PlanRequest):
    names = [m.name for m in payload.meds]
    label_hints = await label_sections(names)  # re-use our extractor
    hint_map = {h.name.lower(): h for h in label_hints}

    items: List[PlanItem] = []
    caveats: List[str] = ["Educational tool only—confirm with a licensed clinician."]

    for m in payload.meds:
        base_times = FREQ_TO_TIMES[m.frequency]
        h = hint_map.get(m.name.lower())
        with_food_flag = m.withFood
        notes = []
        preferred = None
        avoid_kw = []

        if h:
            with_food_flag = with_food_flag or bool(h.hints.get("with_food_hint"))
            if h.hints.get("empty_stomach_hint"):  # override
                with_food_flag = False
                notes.append("Prefer on an empty stomach.")
            preferred = h.hints.get("preferred_time_hint")
            avoid_kw = h.hints.get("avoid_coadmin_keywords", [])
            if preferred == "bedtime":
                base_times = ["22:00"] if m.frequency == "qd" else base_times

        slots = [DoseSlot(time=t, with_food=with_food_flag, notes=notes + (["Avoid with: " + ", ".join(avoid_kw)] if avoid_kw else [])) for t in base_times]
        items.append(PlanItem(med_id=m.id, med_name=m.name, slots=slots))

    # naive spacing rule: if two meds both say "empty stomach", don’t put them at same time
    # (You can expand this with real rulesets per label)
    return PlanResponse(items=items, caveats=caveats)
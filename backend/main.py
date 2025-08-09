import os
from typing import List, Literal, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Allow CRA dev server
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app = FastAPI(title="Med Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Medication(BaseModel):
    id: str
    name: str
    dose: str
    unit: Literal["mg", "mcg", "g", "mL", "tabs", "caps"]
    form: Literal["tablet", "capsule", "liquid", "injection", "other"]
    frequency: Literal["qd", "bid", "tid", "qid", "qod", "prn"]
    withFood: bool
    notes: Optional[str] = ""

class Patient(BaseModel):
    age: Optional[int] = None
    sex: Optional[Literal["male", "female", "other"]] = None
    weightKg: Optional[float] = None
    pregnant: Optional[bool] = None
    breastfeeding: Optional[bool] = None
    conditions: List[str] = []
    allergies: List[str] = []

class InteractionFinding(BaseModel):
    a: str
    b: str
    severity: Literal["Avoid", "Caution", "None"]
    reason: str

class InteractionRequest(BaseModel):
    meds: List[Medication]
    patient: Patient

class InteractionResponse(BaseModel):
    findings: List[InteractionFinding]

# Same demo rules you’re using on the frontend for now
DEMO_RULES = [
    (("ibuprofen", "naproxen"), "Avoid",   "Two NSAIDs increase GI/renal risk without added benefit."),
    (("simvastatin", "clarithromycin"), "Avoid", "Clarithromycin inhibits metabolism of simvastatin → rhabdomyolysis risk."),
    (("warfarin", "ibuprofen"), "Caution", "Bleeding risk increases. Monitor INR and avoid long-term combo."),
    (("metformin", "cimetidine"), "Caution", "May increase metformin levels. Monitor for GI/lactic acidosis risk."),
]

def classify(a: str, b: str):
    aL, bL = a.strip().lower(), b.strip().lower()
    for (x, y), sev, reason in DEMO_RULES:
        if (x in aL and y in bL) or (x in bL and y in aL):
            return sev, reason
    return "None", "No rule matched (placeholder)."

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.post("/api/interactions", response_model=InteractionResponse)
def post_interactions(payload: InteractionRequest):
    meds = payload.meds
    findings: List[InteractionFinding] = []
    for i in range(len(meds)):
        for j in range(i + 1, len(meds)):
            sev, reason = classify(meds[i].name, meds[j].name)
            findings.append(InteractionFinding(a=meds[i].name, b=meds[j].name, severity=sev, reason=reason))
    # TODO: later incorporate patient context, allergies, conditions, etc.
    return InteractionResponse(findings=findings)

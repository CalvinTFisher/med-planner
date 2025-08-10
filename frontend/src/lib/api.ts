export type Medication = {
  id: string;
  name: string;
  dose: string;
  unit: "mg" | "mcg" | "g" | "mL" | "tabs" | "caps";
  form: "tablet" | "capsule" | "liquid" | "injection" | "other";
  frequency: "qd" | "bid" | "tid" | "qid" | "qod" | "prn";
  withFood: boolean;
  notes?: string;
};

export type Patient = {
  age?: number;
  sex?: "male" | "female" | "other";
  weightKg?: number;
  pregnant?: boolean;
  breastfeeding?: boolean;
  conditions: string[];
  allergies: string[];
};

export type Finding = { a: string; b: string; severity: "Avoid"|"Caution"|"None"; reason: string };

const API_BASE = process.env.REACT_APP_API_BASE ?? "";

export async function fetchInteractions(meds: Medication[], patient: Patient) {
  const res = await fetch(`${API_BASE}/api/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meds, patient }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as { findings: Finding[] };
}

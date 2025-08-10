const API_BASE = process.env.REACT_APP_API_BASE ?? "";

export async function normalizeMeds(meds: string[]) {
  const r = await fetch(`${API_BASE}/api/normalize`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meds),
  });
  return r.json();
}

export async function getLabelHints(meds: string[]) {
  const r = await fetch(`${API_BASE}/api/label_sections`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meds),
  });
  return r.json();
}

export async function buildPlan(meds: any[], patient: any) {
  const r = await fetch(`${API_BASE}/api/plan`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meds, patient }),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

import React, { useMemo, useState } from "react";
import { fetchInteractions as apiFetchInteractions } from "./lib/api";
import { buildPlan, getLabelHints, normalizeMeds } from "./lib/planApi";
import { motion } from "framer-motion";
import {
  Pill,
  Stethoscope,
  Syringe,
  CalendarDays,
  Plus,
  Trash2,
  Info,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle2,
  Bot,
  ExternalLink,
} from "lucide-react";

// ==========================================
// Types
// ==========================================

type Medication = {
  id: string;
  name: string;
  dose: string; // e.g., "200"
  unit: "mg" | "mcg" | "g" | "mL" | "tabs" | "caps";
  form: "tablet" | "capsule" | "liquid" | "injection" | "other";
  frequency: "qd" | "bid" | "tid" | "qid" | "qod" | "prn";
  withFood: boolean;
  notes?: string;
};

type Patient = {
  age?: number;
  sex?: "male" | "female" | "other";
  weightKg?: number;
  pregnant?: boolean;
  breastfeeding?: boolean;
  conditions: string[];
  allergies: string[];
};

// ==========================================
// Demo helpers
// ==========================================

const conditionOptions = [
  "Hypertension",
  "Diabetes Type 2",
  "Asthma",
  "CKD (Kidney)",
  "Liver disease",
  "GERD",
  "High cholesterol",
  "Arrhythmia",
];

const timingMap: Record<Medication["frequency"], string[]> = {
  qd: ["08:00"],
  bid: ["08:00", "20:00"],
  tid: ["08:00", "14:00", "20:00"],
  qid: ["06:00", "12:00", "18:00", "22:00"],
  qod: ["08:00 (alt days)"],
  prn: ["As needed"],
};

const demoInteractionRules = [
  {
    pair: ["ibuprofen", "naproxen"],
    severity: "Avoid",
    reason: "Two NSAIDs increase GI/renal risk without added benefit.",
  },
  {
    pair: ["simvastatin", "clarithromycin"],
    severity: "Avoid",
    reason:
      "Clarithromycin inhibits metabolism of simvastatin → rhabdomyolysis risk.",
  },
  {
    pair: ["warfarin", "ibuprofen"],
    severity: "Caution",
    reason:
      "Bleeding risk increases. Monitor INR and avoid long-term combo.",
  },
  {
    pair: ["metformin", "cimetidine"],
    severity: "Caution",
    reason: "May increase metformin levels. Monitor for GI/lactic acidosis risk.",
  },
] as const;

function classifyInteraction(a: string, b: string) {
  const aL = a.trim().toLowerCase();
  const bL = b.trim().toLowerCase();
  for (const r of demoInteractionRules) {
    const [x, y] = r.pair;
    if ((aL.includes(x) && bL.includes(y)) || (aL.includes(y) && bL.includes(x))) {
      return { severity: r.severity, reason: r.reason } as const;
    }
  }
  return { severity: "None", reason: "No demo rule matched (placeholder)." } as const;
}

// ==========================================
// Reusable tiny bits (no external UI lib)
// ==========================================

function Btn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "ghost" | "outline";
    size?: "sm" | "md" | "lg";
  }
) {
  const { className = "", variant = "default", size = "md", ...rest } = props;
  const base =
    "inline-flex items-center justify-center rounded-md border text-sm font-medium transition-colors";
  const sizes: Record<string, string> = {
    sm: "h-8 px-3",
    md: "h-9 px-3",
    lg: "h-10 px-4",
  };
  const variants: Record<string, string> = {
    default: "bg-slate-900 text-white border-slate-900 hover:bg-slate-800",
    ghost: "bg-transparent border-transparent hover:bg-slate-100",
    outline: "bg-white border-slate-300 text-slate-900 hover:bg-slate-50",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest} />
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-white ${className}`}>{children}</div>
  );
}

function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 border-b ${className}`}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-lg font-semibold">{children}</div>;
}
function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

function Badge({ children, className = "", variant = "secondary" as "secondary" | "destructive" | "outline" }) {
  const styles =
    variant === "destructive"
      ? "bg-red-100 text-red-800 border-red-200"
      : variant === "outline"
      ? "bg-white text-slate-700 border-slate-300"
      : "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles} ${className}`}>
      {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100">
        <Icon className="h-6 w-6 text-blue-700" />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// Tiny Tabs (no external dependency)
function Tabs(
  { value, onValueChange, children, className = "" }:
  { value: string; onValueChange: (v: string) => void; children: React.ReactNode; className?: string }
) {
  return <div className={className}>{children}</div>;
}
function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}
function TabsTrigger(
  { value, active, onClick, children }:
  { value: string; active: boolean; onClick: (v: string) => void; children: React.ReactNode }
) {
  return (
    <Btn variant={active ? "default" : "ghost"} onClick={() => onClick(value)}>
      {children}
    </Btn>
  );
}
function TabsContent({ when, value, children, className = "" }: { when: string; value: string; children: React.ReactNode; className?: string }) {
  if (when !== value) return null;
  return <div className={className}>{children}</div>;
}

// ==========================================
// Main App
// ==========================================

export default function App() {
  const [activeTab, setActiveTab] = useState("planner");
  const [patient, setPatient] = useState<Patient>({ conditions: [], allergies: [] });
  const [meds, setMeds] = useState<Medication[]>([]);
  const [draft, setDraft] = useState<Medication>({
    id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    name: "",
    dose: "",
    unit: "mg",
    form: "tablet",
    frequency: "qd",
    withFood: false,
    notes: "",
  });

const [proposed, setProposed] = useState<{ items: any[]; caveats: string[] }>({ items: [], caveats: [] });
const [planning, setPlanning] = useState(false);
const [planError, setPlanError] = useState<string | null>(null);

async function onGeneratePlan() {
  if (meds.length === 0) return;
  setPlanning(true);
  setPlanError(null);
  try {
    const p = await buildPlan(meds, patient);
    setProposed(p);
    setActiveTab("plan"); // jump to the Plan tab when ready
  } catch (e: any) {
    setPlanError(e?.message ?? "Failed to build plan.");
    setProposed({ items: [], caveats: [] });
  } finally {
    setPlanning(false);
  }
}



  // Server-backed interaction findings
  const [serverFindings, setServerFindings] = useState<
    { a: string; b: string; severity: string; reason: string }[]
  >([]);

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function fetchInteractions() {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await apiFetchInteractions(meds, patient);
      setServerFindings(data.findings || []);
    } catch (e: any) {
      console.error("interaction fetch failed", e);
      setServerFindings([]);
      setApiError(e?.message ?? "Failed to fetch interactions.");
    } finally {
      setIsLoading(false);
    }
  }



  const interactionFindings = useMemo(() => {
    const out: { a: string; b: string; severity: string; reason: string }[] = [];
    for (let i = 0; i < meds.length; i++) {
      for (let j = i + 1; j < meds.length; j++) {
        const res = classifyInteraction(meds[i].name, meds[j].name);
        out.push({ a: meds[i].name, b: meds[j].name, ...res });
      }
    }
    return out;
  }, [meds]);

  function addMedication() {
    if (!draft.name.trim() || !draft.dose.trim()) return;
    setMeds((cur) => [...cur, draft]);
    setDraft({
      id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      name: "",
      dose: "",
      unit: "mg",
      form: "tablet",
      frequency: "qd",
      withFood: false,
      notes: "",
    });
  }

  function removeMedication(id: string) {
    setMeds((cur) => cur.filter((m) => m.id !== id));
  }

  function toggleArrayField(field: "conditions" | "allergies", value: string) {
    setPatient((p) => {
      const set = new Set(p[field]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...p, [field]: Array.from(set) } as Patient;
    });
  }

  const freqOptions = [
    { value: "qd",  label: "QD — Once daily" },
    { value: "bid", label: "BID — Twice daily" },
    { value: "tid", label: "TID — Three times daily" },
    { value: "qid", label: "QID — Four times daily" },
    { value: "qod", label: "QOD — Every other day" },
    { value: "prn", label: "PRN — As needed" },
  ];


  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/50 bg-white/70 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500" />
            <div className="leading-tight">
              <p className="text-sm text-slate-500">Calvin's Personal Website</p>
              <h1 className="text-base font-semibold">Med Interaction & Planner</h1>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {(["planner", "interactions", "resources", "about"] as const).map((t) => (
              <Btn key={t} variant={activeTab === t ? "default" : "ghost"} onClick={() => setActiveTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </Btn>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl bg-gradient-to-br from-cyan-300/40 to-blue-400/40" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.15 }} className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl bg-gradient-to-br from-violet-300/40 to-fuchsia-400/40" />
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.25 }} className="absolute right-10 top-10 rotate-12 opacity-20">
            <Pill className="h-32 w-32" />
          </motion.div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <motion.h2 initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="text-4xl md:text-5xl font-bold tracking-tight">
              Safer medication plans, <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">clearer days</span>.
            </motion.h2>
            <p className="mt-4 text-slate-600 max-w-prose">
              A clean, modern interface to capture your current regimen and surface <strong>potential interactions</strong>, <strong>timing guidance</strong>, and <strong>best practices</strong>.
            </p>
            <div className="mt-6 flex gap-3">
              <Btn size="lg" onClick={() => setActiveTab("planner")}>Get started</Btn>
              <Btn size="lg" variant="outline" onClick={() => setActiveTab("resources")}>View data sources</Btn>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Bot className="h-3.5 w-3.5" /> Demo-only logic on this page. Not medical advice.
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5"/>Quick Add</CardTitle>
                <CardDescription>Try adding two demo meds (e.g., "ibuprofen" and "naproxen").</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Medication</label>
                  <input className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="e.g., Ibuprofen" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Dose</label>
                    <input className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="e.g., 200" value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit</label>
                    <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Medication["unit"] })}>
                      {["mg","mcg","g","mL","tabs","caps"].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Form</label>
                  <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={draft.form} onChange={(e) => setDraft({ ...draft, form: e.target.value as Medication["form"] })}>
                    {["tablet","capsule","liquid","injection","other"].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Medication["frequency"] })}>
                    {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea className="w-full min-h-[84px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Optional notes (brand, timing prefs, etc.)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                </div>

                <div className="flex items-center gap-2">
                  <input id="withFood" type="checkbox" className="h-4 w-4" checked={draft.withFood} onChange={(e) => setDraft({ ...draft, withFood: e.target.checked })} />
                  <label htmlFor="withFood" className="text-sm">Take with food</label>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <Btn onClick={addMedication}><Plus className="h-4 w-4 mr-1"/>Add medication</Btn>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 grid grid-cols-5 w-full">
            {(["planner","interactions","plan","resources","about"] as const).map((t) => (
              <TabsTrigger key={t} value={t} active={activeTab === t} onClick={setActiveTab}>
                {t[0].toUpperCase() + t.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* PLANNER */}
          <TabsContent when="planner" value={activeTab} className="space-y-8">
            <Card>
              <CardHeader>
                <SectionHeader icon={CalendarDays} title="Your regimen" subtitle="Add meds and basic health context."/>
                <div className="mt-3 flex items-center gap-2">
                  <Btn onClick={onGeneratePlan}>Generate plan</Btn>
                  {planning && <span className="text-sm text-slate-500">Building…</span>}
                  {planError && <span className="text-sm text-red-600">{planError}</span>}
                </div>

              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  {meds.length === 0 && (
                    <div className="text-sm text-slate-500">No medications added yet.</div>
                  )}

                  <div className="grid gap-3">
                    {meds.map((m) => (
                      <div key={m.id} className="flex items-start justify-between rounded-2xl border p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="capitalize">{m.form}</Badge>
                            <p className="font-medium">{m.name}</p>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {m.dose} {m.unit} · {m.frequency.toUpperCase()} · {m.withFood ? "with food" : "without food"}
                          </p>
                          {m.notes && <p className="text-sm mt-1">{m.notes}</p>}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {timingMap[m.frequency].map((t) => (
                              <Chip key={t}>{t}</Chip>
                            ))}
                          </div>
                        </div>
                        <Btn variant="ghost" onClick={() => removeMedication(m.id)}><Trash2 className="h-4 w-4"/></Btn>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">Patient info</h3>
                    <p className="text-xs text-slate-500">These fields help tailor warnings later.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Age</label>
                      <input type="number" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="e.g., 28" onChange={(e) => setPatient((p) => ({ ...p, age: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Weight (kg)</label>
                      <input type="number" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="e.g., 70" onChange={(e) => setPatient((p) => ({ ...p, weightKg: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sex</label>
                      <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={patient.sex ?? ""} onChange={(e) => setPatient((p) => ({ ...p, sex: (e.target.value || undefined) as Patient["sex"] }))}>
                        <option value="">Select…</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 mt-7">
                      <input id="pregnant" type="checkbox" className="h-4 w-4" checked={!!patient.pregnant} onChange={(e) => setPatient((p) => ({ ...p, pregnant: e.target.checked }))} />
                      <label htmlFor="pregnant" className="text-sm">Pregnant</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="bf" type="checkbox" className="h-4 w-4" checked={!!patient.breastfeeding} onChange={(e) => setPatient((p) => ({ ...p, breastfeeding: e.target.checked }))} />
                      <label htmlFor="bf" className="text-sm">Breastfeeding</label>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200" />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Conditions</label>
                    <div className="flex flex-wrap gap-2">
                      {conditionOptions.map((c) => (
                        <button key={c} onClick={() => toggleArrayField("conditions", c)} className={`px-2.5 py-1 rounded-full border text-xs ${patient.conditions.includes(c) ? "bg-blue-50 border-blue-200" : "hover:bg-slate-50"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Allergies</label>
                    <textarea className="w-full min-h-[84px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Comma-separated, e.g., penicillin, latex" onBlur={(e) => setPatient((p) => ({ ...p, allergies: e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean) }))} />
                    {patient.allergies.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {patient.allergies.map((a) => (
                          <Badge key={a} variant="outline">{a}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTERACTIONS */}
          <TabsContent when="interactions" value={activeTab} className="space-y-8">
            <Card>
              <CardHeader>
                <SectionHeader icon={Syringe} title="Interaction check" subtitle="Powered by your backend (FastAPI)."/>
                <div className="mt-3 flex items-center gap-2">
                  <Btn onClick={fetchInteractions}>Check with backend</Btn>
                  {isLoading && <span className="text-sm text-slate-500">Checking…</span>}
                  {apiError && <span className="text-sm text-red-600">{apiError}</span>}
                </div>
              </CardHeader>
              <CardContent>
                {meds.length < 2 ? (
                  <div className="text-sm text-slate-500">Add at least two medications in the Planner tab.</div>
                ) : (
                  <div className="grid gap-3">
                    {(serverFindings.length > 0 ? serverFindings : interactionFindings).map((f, idx) => (
                      <div key={idx} className="flex items-start justify-between rounded-2xl border p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            {f.severity === "Avoid" ? (
                              <Badge variant="destructive">Avoid</Badge>
                            ) : f.severity === "Caution" ? (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-200">Caution</Badge>
                            ) : (
                              <Badge>None</Badge>
                            )}
                            <p className="font-medium">{f.a} ↔ {f.b}</p>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{f.reason}</p>
                        </div>
                        {f.severity === "Avoid" ? (
                          <AlertTriangle className="h-5 w-5 text-red-600"/>
                        ) : f.severity === "Caution" ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500"/>
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500"/>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {meds.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Suggested timing (demo)</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {meds.map((m) => (
                        <div key={m.id} className="rounded-2xl border p-3">
                          <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4" />
                            <p className="font-medium">{m.name}</p>
                            <Badge variant="outline">{m.dose} {m.unit}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {timingMap[m.frequency].map((t) => (
                              <Chip key={t}>{t}</Chip>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {m.withFood ? "Prefer with food." : "Food not required (unless directed)."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-6 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" /> This interface is a demo and not a substitute for professional medical advice.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLAN */}
          <TabsContent when="plan" value={activeTab} className="space-y-8">
            <Card>
              <CardHeader>
                <SectionHeader icon={CalendarDays} title="Proposed medication plan" subtitle="Times, food guidance, and co‑admin notes."/>
                <div className="mt-3 flex items-center gap-2">
                  <Btn variant="outline" onClick={onGeneratePlan}>Regenerate</Btn>
                  {planning && <span className="text-sm text-slate-500">Building…</span>}
                  {planError && <span className="text-sm text-red-600">{planError}</span>}
                </div>
              </CardHeader>

              <CardContent>
                {proposed.items.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No plan yet. Add medications in Planner → Interactions → click <span className="font-medium">Generate plan</span>.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {proposed.items.map((item: any) => (
                      <div key={item.med_id} className="rounded-2xl border p-4">
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          <p className="font-semibold">{item.med_name}</p>
                        </div>

                        <div className="mt-2 space-y-2">
                          {item.slots.map((s: any, i: number) => (
                            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                              <Chip>{s.time}</Chip>
                              {s.with_food === true && <Badge variant="outline">with food</Badge>}
                              {s.with_food === false && <Badge variant="outline">empty stomach</Badge>}
                              {s.notes?.length > 0 && <span className="text-slate-500">· {s.notes.join(" · ")}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {proposed.caveats?.length > 0 && (
                  <p className="text-xs text-slate-500 mt-6">{proposed.caveats.join(" ")}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESOURCES */}
          <TabsContent when="resources" value={activeTab} className="space-y-6">
            <Card>
              <CardHeader>
                <SectionHeader icon={LinkIcon} title="Planned data sources" subtitle="These are reputable APIs/references we can wire up."/>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ResourceCard title="OpenFDA" desc="Public FDA datasets (drugs, devices, adverse events)." href="https://open.fda.gov/" />
                <ResourceCard title="RxNorm (NLM)" desc="Normalized drug names/relationships; great for interaction mapping." href="https://www.nlm.nih.gov/research/umls/rxnorm/" />
                <ResourceCard title="DailyMed" desc="Official FDA label text (package inserts) for dosing, warnings, timing." href="https://dailymed.nlm.nih.gov/dailymed/" />
                <ResourceCard title="MedlinePlus" desc="Patient-friendly info on medications and conditions." href="https://medlineplus.gov/druginformation.html" />
                <ResourceCard title="DrugBank (licensing)" desc="Extensive interaction/PK data (commercial license likely needed)." href="https://go.drugbank.com/" />
                <ResourceCard title="Open Data FDA: FAERS" desc="Adverse event reporting system – signals for safety monitoring." href="https://fis.fda.gov/extensions/FPD/FAERS/FAERS.html" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABOUT */}
          <TabsContent when="about" value={activeTab} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About this project</CardTitle>
                <CardDescription>
                  <span className="font-medium">Goal:</span> Create a fully functioning, well-designed UI for medication planning and interaction checks under
                  <span className="ml-1 font-semibold"> Calvin's Personal Website</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>
                  This is the <strong>frontend</strong> only. The interaction logic shown uses <em>demo rules</em> and is not medical advice. Next step: connect the form
                  to APIs (OpenFDA, RxNorm) and your own backend to compute interactions with real data.
                </p>
                <ul className="list-disc pl-5 text-sm text-slate-600">
                  <li>Mobile-first, responsive layout with clean typography and subtle gradients.</li>
                  <li>Framer Motion micro-animations for delightful interactions.</li>
                  <li>Accessible form components and clear, readable cards/badges.</li>
                </ul>
                <p className="text-xs text-slate-500">
                  Disclaimer: Do not rely on this demo for clinical decisions. Always consult a licensed professional.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Calvin's Personal Website · For educational/demo use only.</p>
          <div className="flex items-center gap-4">
            <a className="hover:underline" href="#">Privacy</a>
            <a className="hover:underline" href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ResourceCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group">
      <div className="rounded-2xl border p-4 hover:shadow-md transition-shadow bg-white/60">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
        </div>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
      </div>
    </a>
  );
}

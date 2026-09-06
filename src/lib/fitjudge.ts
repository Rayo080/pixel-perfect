export type Meal = {
  id: string;
  nombreComida: string;
  calorias: number;
  proteinas: number;
  comentarioEstricto: string;
  image?: string | undefined;
  time: string;
  createdAt: string;
};

export type BodyAssessment = {
  nivelMuscularVisual: string;
  composicionVisual: string;
  posturaObservada: string;
  confianza: "baja" | "media" | "alta" | string;
  veredictoInicial: string;
  limitaciones: string;
  recomendacionCalorias?: number;
  recomendacionProteinas?: number;
  mantenimientoCalorias?: number;
  nivelExigencia?: string;
};

export type WorkoutType = "strength" | "boxing" | "high-intensity" | "rest";

export type WeeklyPlanEntry = {
  activity: WorkoutType;
  hours: number;
};

export type WeeklyPlan = Record<string, WeeklyPlanEntry>;

export type Settings = {
  apiKey: string;
  userName: string;
  profileComplete: boolean;
  age: number;
  weight: number;
  height: number;
  gender: "female" | "male" | "other";
  activity: "low" | "light" | "moderate" | "high" | "very-high";
  goals: string[];
  maintenanceCalories: number;
  metaCalorias: number;
  metaProteinas: number;
  stepsDaily: number;
  additionalDetails: string;
  weeklyPlan: WeeklyPlan;
  dailyOverrideDate?: string;
  dailyOverrideActivity?: WorkoutType;
  bodyAssessment?: BodyAssessment;
};

const MEALS_KEY = "fitjudge.meals";
const SETTINGS_KEY = "fitjudge.settings";

export function toFiniteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const defaultSettings: Settings = {
  apiKey: "",
  userName: "",
  profileComplete: false,
  age: 30,
  weight: 70,
  height: 170,
  gender: "other",
  activity: "moderate",
  goals: [],
  maintenanceCalories: 2000,
  metaCalorias: 2000,
  metaProteinas: 150,
  stepsDaily: 6000,
  additionalDetails: "",
  weeklyPlan: {},
};

export const activityOptions = [
  { value: "low", label: "Poco activa", description: "Trabajo sentado y poco ejercicio" },
  { value: "light", label: "Algo activa", description: "Entrenamiento suave 1-3 días/semana" },
  {
    value: "moderate",
    label: "Moderadamente activa",
    description: "Entrenamiento 3-5 días/semana",
  },
  { value: "high", label: "Muy activa", description: "Entrenamiento intenso 6-7 días/semana" },
  {
    value: "very-high",
    label: "Extremadamente activa",
    description: "Trabajo físico y entrenamiento intenso",
  },
] as const;

export const goalOptions = [
  { value: "lose-fat", label: "Perder grasa" },
  { value: "gain-muscle", label: "Ganar músculo" },
  { value: "maintain", label: "Mantener mi peso" },
  { value: "improve-performance", label: "Mejorar mi rendimiento" },
] as const;

export type ProfileInput = Pick<
  Settings,
  | "userName"
  | "age"
  | "weight"
  | "height"
  | "gender"
  | "activity"
  | "goals"
  | "additionalDetails"
  | "weeklyPlan"
  | "stepsDaily"
>;

export const weekDays = [
  ["monday", "Lunes"],
  ["tuesday", "Martes"],
  ["wednesday", "Miércoles"],
  ["thursday", "Jueves"],
  ["friday", "Viernes"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
] as const;

export const defaultWeeklyPlan = (): WeeklyPlan =>
  Object.fromEntries(weekDays.map(([day]) => [day, { activity: "rest", hours: 0 }]));

export function getDailyTargets(settings: Settings, date = new Date()) {
  const dayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    date.getDay()
  ]!;
  const todayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const planned = settings.weeklyPlan?.[dayKey] ?? {
    activity: "rest" as const,
    hours: 0,
  };
  const activity =
    settings.dailyOverrideDate === todayKey && settings.dailyOverrideActivity
      ? settings.dailyOverrideActivity
      : planned.activity;
  const isCancelled = settings.dailyOverrideDate === todayKey && activity === "rest";
  const hours = Math.max(
    0,
    toFiniteNumber(planned.hours ?? planned.strengthHours ?? planned.intensityHours, 0),
  );
  const energy = calculateDailyEnergy({
    weightKg: toFiniteNumber(settings.weight, 70),
    heightCm: toFiniteNumber(settings.height, 170),
    age: toFiniteNumber(settings.age, 30),
    gender: settings.gender,
    stepsDaily: Math.max(0, toFiniteNumber(settings.stepsDaily, 6000)),
    activity,
    minutes: hours * 60,
  });
  const trainingBonus = isCancelled ? 0 : energy.eat + energy.epoc;
  const maintenanceCalories = isCancelled
    ? energy.bmr + energy.neat + Math.round((energy.bmr + energy.neat) * 0.1)
    : energy.tdee;
  return {
    dayKey,
    activity,
    plannedActivity: planned.activity === "rest" ? "rest" : planned.activity,
    isCancelled,
    hours,
    trainingBonus,
    maintenanceCalories,
    metaCalorias: Math.max(
      1200,
      maintenanceCalories +
        (settings.goals.includes("lose-fat")
          ? -400
          : settings.goals.includes("gain-muscle")
            ? 300
            : 0),
    ),
    energy,
  };
}

export function calculateTargets(profile: ProfileInput) {
  const energy = calculateDailyEnergy({
    weightKg: toFiniteNumber(profile.weight, 70),
    heightCm: toFiniteNumber(profile.height, 170),
    age: toFiniteNumber(profile.age, 30),
    gender: profile.gender,
    stepsDaily: Math.max(0, toFiniteNumber(profile.stepsDaily, 6000)),
    activity: "rest",
    minutes: 0,
  });
  const maintenanceCalories = energy.tdee;
  const calorieAdjustment = profile.goals.includes("lose-fat")
    ? -400
    : profile.goals.includes("gain-muscle")
      ? 300
      : 0;
  const metaCalorias = Math.max(1200, maintenanceCalories + calorieAdjustment);
  const metaProteinas = Math.round(
    toFiniteNumber(profile.weight, 70) * (profile.goals.includes("gain-muscle") ? 2 : 1.7),
  );

  return { maintenanceCalories, metaCalorias, metaProteinas, energy };
}

const activityMet: Record<WorkoutType, number> = {
  rest: 1,
  strength: 5,
  boxing: 7.8,
  "high-intensity": 7,
};

export function calculateDailyEnergy({
  weightKg,
  heightCm,
  age,
  gender,
  stepsDaily,
  activity,
  minutes,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Settings["gender"];
  stepsDaily: number;
  activity: WorkoutType;
  minutes: number;
}) {
  const sexConstant = gender === "male" ? 5 : gender === "female" ? -161 : -78;
  const safeWeight = toFiniteNumber(weightKg, 70);
  const safeHeight = toFiniteNumber(heightCm, 170);
  const safeAge = toFiniteNumber(age, 30);
  const safeSteps = Math.max(0, toFiniteNumber(stepsDaily, 6000));
  const safeMinutes = Math.max(0, toFiniteNumber(minutes, 0));
  const bmr = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + sexConstant;
  const neat = safeSteps * 0.04 + 300;
  const met = activityMet[activity];
  const eat = met > 1 ? (((met - 1) * 3.5 * safeWeight) / 200) * safeMinutes : 0;
  const subtotal = bmr + neat + eat;
  const tef = subtotal * 0.1;
  const epoc = activity === "strength" && safeMinutes > 0 ? 65 : 0;
  return {
    bmr: Math.round(bmr),
    neat: Math.round(neat),
    eat: Math.round(eat),
    epoc,
    tef: Math.round(tef),
    tdee: Math.round(subtotal + tef + epoc),
  };
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadMeals(): Meal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MEALS_KEY) || "[]") as Meal[];
  } catch {
    return [];
  }
}

export function saveMeals(m: Meal[]) {
  localStorage.setItem(MEALS_KEY, JSON.stringify(m));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function splitDataUrl(dataUrl: string | null) {
  if (!dataUrl) return { imageBase64: "", mimeType: "image/jpeg" };
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  return match
    ? { imageBase64: match[2], mimeType: match[1] }
    : { imageBase64: dataUrl, mimeType: "image/jpeg" };
}

const SYSTEM_PROMPT = `Eres "El Entrenador Estricto", un entrenador personal exigente, ácido y divertido.
Analiza la comida de la foto y la descripción del usuario. Estima calorías y proteínas totales del plato.
Responde SIEMPRE y ÚNICAMENTE con un JSON válido con esta estructura exacta, sin markdown ni texto extra:
{ "calorias": number, "proteinas": number, "nombreComida": string, "comentarioEstricto": string }
El campo comentarioEstricto debe ser una frase corta (máx 200 caracteres), sarcástica y exigente, en español.`;

export type Analysis = {
  calorias: number;
  proteinas: number;
  nombreComida: string;
  comentarioEstricto: string;
};

export async function analyzeMeal(
  apiKey: string,
  imageBase64: string | null,
  description: string,
): Promise<Analysis> {
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: description
        ? `Descripción del usuario: ${description}`
        : "El usuario no ha dado descripción. Deduce el plato de la foto.",
    },
  ];
  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: imageBase64 } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error de la IA (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Analysis;
  return {
    calorias: Number(parsed.calorias) || 0,
    proteinas: Number(parsed.proteinas) || 0,
    nombreComida: parsed.nombreComida || "Plato misterioso",
    comentarioEstricto: parsed.comentarioEstricto || "Sin comentarios. Y eso ya dice mucho.",
  };
}

// Modo demo: sin API key, generamos un juicio simulado.
const DEMO_COMENTARIOS = [
  "¿Eso es una comida o una disculpa? Mañana quiero verte con proteína de verdad.",
  "Aceptable. No te emociones, tampoco es para poner un cuadro.",
  "He visto ensaladas con más carácter que tu entrenamiento de ayer.",
  "Calorías vacías, promesas llenas. Clásico de ti.",
  "Bien. Repítelo mañana y quizá deje de mirarte con desprecio.",
];

export async function analyzeMealDemo(description: string): Promise<Analysis> {
  await new Promise((r) => setTimeout(r, 1400));
  const base = 250 + Math.round(Math.random() * 500);
  return {
    calorias: base,
    proteinas: 10 + Math.round(Math.random() * 40),
    nombreComida: description ? description.slice(0, 40) : "Plato sin identificar",
    comentarioEstricto:
      DEMO_COMENTARIOS[Math.floor(Math.random() * DEMO_COMENTARIOS.length)] ?? DEMO_COMENTARIOS[0]!,
  };
}

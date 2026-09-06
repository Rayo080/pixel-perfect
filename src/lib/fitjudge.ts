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
  additionalDetails: string;
  bodyAssessment?: BodyAssessment;
};

const MEALS_KEY = "fitjudge.meals";
const SETTINGS_KEY = "fitjudge.settings";

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
  additionalDetails: "",
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
  "userName" | "age" | "weight" | "height" | "gender" | "activity" | "goals" | "additionalDetails"
>;

export function calculateTargets(profile: ProfileInput) {
  const base = profile.gender === "male" ? 5 : profile.gender === "female" ? -161 : -78;
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + base;
  const activityMultiplier = {
    low: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    "very-high": 1.9,
  }[profile.activity];
  const maintenanceCalories = Math.round((bmr * activityMultiplier) / 50) * 50;
  const calorieAdjustment = profile.goals.includes("lose-fat")
    ? -400
    : profile.goals.includes("gain-muscle")
      ? 250
      : 0;
  const metaCalorias = Math.max(1200, maintenanceCalories + calorieAdjustment);
  const metaProteinas = Math.round(
    profile.weight * (profile.goals.includes("gain-muscle") ? 2 : 1.7),
  );

  return { maintenanceCalories, metaCalorias, metaProteinas };
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

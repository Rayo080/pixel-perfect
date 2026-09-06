export type Meal = {
  id: string;
  nombreComida: string;
  calorias: number;
  proteinas: number;
  comentarioEstricto: string;
  image?: string | undefined;
  time: string;
};

export type Settings = {
  apiKey: string;
  metaCalorias: number;
  metaProteinas: number;
};

const MEALS_KEY = "fitjudge.meals";
const SETTINGS_KEY = "fitjudge.settings";

export const defaultSettings: Settings = {
  apiKey: "",
  metaCalorias: 2000,
  metaProteinas: 150,
};

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

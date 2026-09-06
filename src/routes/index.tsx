import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Beef, Flame, ImagePlus, RotateCcw, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { ProgressCard } from "@/components/fitjudge/ProgressCard";
import { CoachBubble } from "@/components/fitjudge/CoachBubble";
import { SettingsDialog } from "@/components/fitjudge/SettingsDialog";
import {
  analyzeMeal,
  analyzeMealDemo,
  defaultSettings,
  fileToBase64,
  loadMeals,
  loadSettings,
  saveMeals,
  saveSettings,
  type Meal,
  type Settings,
} from "@/lib/fitjudge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitJudge AI — Tu entrenador estricto de nutrición" },
      {
        name: "description",
        content:
          "Sube la foto de tu plato y deja que un entrenador virtual sin piedad calcule calorías, proteínas y te juzgue sin filtros.",
      },
      { property: "og:title", content: "FitJudge AI — Tu entrenador estricto de nutrición" },
      {
        property: "og:description",
        content:
          "Fotografía tu comida, recibe calorías y proteínas al instante y aguanta el veredicto del entrenador más exigente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const WELCOME = "Otra vez tú. Enséñame ese plato y no me hagas perder el tiempo.";

function Index() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [coachMessage, setCoachMessage] = useState(WELCOME);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(loadSettings());
    const stored = loadMeals();
    setMeals(stored);
    if (stored.length) setCoachMessage(stored[0].comentarioEstricto);
  }, []);

  const persist = (next: Meal[]) => {
    setMeals(next);
    saveMeals(next);
  };

  const totalKcal = meals.reduce((a, m) => a + m.calorias, 0);
  const totalProt = meals.reduce((a, m) => a + m.proteinas, 0);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Eso no es una imagen.");
      return;
    }
    setImage(await fileToBase64(file));
  }, []);

  const submit = async () => {
    if (!image && !description.trim()) {
      toast.error("Sube una foto o describe el plato.");
      return;
    }
    setLoading(true);
    try {
      const result = settings.apiKey
        ? await analyzeMeal(settings.apiKey, image, description.trim())
        : await analyzeMealDemo(description.trim());

      const meal: Meal = {
        id: crypto.randomUUID(),
        ...result,
        image: image ?? undefined,
        time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      };
      persist([meal, ...meals]);
      setCoachMessage(result.comentarioEstricto);
      setImage(null);
      setDescription("");
      if (!settings.apiKey) toast("Modo demo: añade tu API key en Ajustes para análisis reales.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Algo salió mal con el análisis.");
    } finally {
      setLoading(false);
    }
  };

  const newDay = () => {
    persist([]);
    setCoachMessage("Día nuevo, excusas nuevas. A ver si hoy me sorprendes.");
  };

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Fit<span className="text-primary text-glow">Judge</span> AI
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nutrición estricta. Sin excusas, sin piedad.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SettingsDialog
              settings={settings}
              onSave={(s) => {
                setSettings(s);
                saveSettings(s);
                toast.success("Ajustes guardados.");
              }}
            />
            <Button variant="outline" size="sm" onClick={newDay}>
              <RotateCcw className="size-4" /> Nuevo día
            </Button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <ProgressCard
            label="Calorías"
            current={totalKcal}
            goal={settings.metaCalorias}
            unit="kcal"
            icon={<Flame className="size-4" />}
          />
          <ProgressCard
            label="Proteínas"
            current={totalProt}
            goal={settings.metaProteinas}
            unit="g"
            overIsBad={false}
            icon={<Beef className="size-4" />}
          />
        </section>

        <section className="mt-4">
          <CoachBubble message={coachMessage} thinking={loading} />
        </section>

        <section className="card-heat mt-4 rounded-2xl p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
            }`}
          >
            {image ? (
              <>
                <img
                  src={image}
                  alt="Plato a analizar"
                  className="max-h-56 w-auto rounded-lg object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImage(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-secondary p-1.5 text-secondary-foreground"
                  aria-label="Quitar foto"
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                <ImagePlus className="size-8 text-primary" />
                <p className="mt-2 text-sm font-medium">Arrastra la foto de tu plato</p>
                <p className="text-xs text-muted-foreground">o haz clic para subir / capturar</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          <Textarea
            className="mt-4 min-h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe qué es esto si la foto no es clara (ej: Pechuga de pollo con arroz integral y aceite de oliva)"
          />

          <Button className="mt-4 w-full" size="lg" disabled={loading} onClick={submit}>
            <Send className="size-4" />
            {loading ? "Analizando plato con desaprobación..." : "Enviar al juicio de la IA"}
          </Button>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Historial de hoy
          </h2>

          <div className="mt-3 space-y-3">
            {loading && (
              <div className="card-heat flex items-center gap-4 rounded-2xl p-4">
                <Skeleton className="size-16 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            )}

            {!loading && meals.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Todavía no has registrado nada. El entrenador está esperando.
              </p>
            )}

            {meals.map((meal) => (
              <article key={meal.id} className="card-heat flex items-start gap-4 rounded-2xl p-4">
                {meal.image ? (
                  <img
                    src={meal.image}
                    alt={meal.nombreComida}
                    loading="lazy"
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Flame className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold">{meal.nombreComida}</h3>
                    <span className="text-xs text-muted-foreground">{meal.time}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-bold text-primary">{meal.calorias} kcal</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-bold text-success">{meal.proteinas} g proteína</span>
                  </p>
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    “{meal.comentarioEstricto}”
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Eliminar comida"
                  onClick={() => persist(meals.filter((m) => m.id !== meal.id))}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

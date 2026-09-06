import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Beef,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  Flame,
  ImagePlus,
  LogOut,
  ShieldAlert,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { ProgressCard } from "@/components/fitjudge/ProgressCard";
import { CoachBubble } from "@/components/fitjudge/CoachBubble";
import { SettingsDialog } from "@/components/fitjudge/SettingsDialog";
import {
  analyzeMealDemo,
  activityOptions,
  calculateTargets,
  defaultSettings,
  fileToBase64,
  goalOptions,
  saveSettings,
  splitDataUrl,
  type Meal,
  type BodyAssessment,
  type ProfileInput,
  type Settings,
} from "@/lib/fitjudge";
import { supabase } from "@/lib/supabase";

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

const getDateKey = (date: string | Date) => {
  const value = typeof date === "string" ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (dateKey: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("es-ES", options);

function Index() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [view, setView] = useState<"auth" | "onboarding" | "app">("auth");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()));
  const [daysExpanded, setDaysExpanded] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [coachMessage, setCoachMessage] = useState(WELCOME);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadUserData = async (user: { id: string; user_metadata?: { name?: string } }) => {
      const [{ data: profile, error: profileError }, { data: rows, error: mealsError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("meals")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);
      if (profileError) throw profileError;
      if (mealsError) throw mealsError;
      if (!mounted) return;

      const nextSettings: Settings = profile
        ? {
            ...defaultSettings,
            userName: profile.name || user.user_metadata?.name || "",
            profileComplete: Boolean(
              profile.age && profile.weight && profile.height && profile.goals?.length,
            ),
            age: profile.age ?? defaultSettings.age,
            weight: profile.weight ?? defaultSettings.weight,
            height: profile.height ?? defaultSettings.height,
            gender: profile.gender ?? defaultSettings.gender,
            activity: profile.activity ?? defaultSettings.activity,
            goals:
              typeof profile.goals === "string"
                ? profile.goals.split(",").filter(Boolean)
                : (profile.goals ?? []),
            maintenanceCalories:
              profile.maintenance_calories ?? defaultSettings.maintenanceCalories,
            metaCalorias: profile.target_calories ?? defaultSettings.metaCalorias,
            metaProteinas: profile.target_proteins ?? defaultSettings.metaProteinas,
            additionalDetails: profile.additional_details ?? defaultSettings.additionalDetails,
            bodyAssessment: profile.body_assessment ?? undefined,
          }
        : { ...defaultSettings, userName: user.user_metadata?.name || "" };
      setSettings(nextSettings);
      setMeals(
        (rows ?? []).map((row) => ({
          id: row.id,
          nombreComida: row.name,
          calorias: row.calories,
          proteinas: row.proteins,
          comentarioEstricto: row.comment || "Sin comentarios. Sigue registrando.",
          image: row.image_url || undefined,
          time: new Date(row.created_at).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          createdAt: row.created_at,
        })),
      );
      setSelectedDate(getDateKey(new Date()));
      setView(nextSettings.profileComplete ? "app" : "onboarding");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUserId(session.user.id);
        void loadUserData(session.user).catch((error) => toast.error(error.message));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        void loadUserData(session.user).catch((error) => toast.error(error.message));
      } else {
        setUserId(null);
        setMeals([]);
        setSettings(defaultSettings);
        setView("auth");
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const persistMeal = async (meal: Meal) => {
    if (!userId) return;
    const { error } = await supabase.from("meals").insert({
      id: meal.id,
      user_id: userId,
      name: meal.nombreComida,
      calories: meal.calorias,
      proteins: meal.proteinas,
      comment: meal.comentarioEstricto,
      image_url: meal.image ?? null,
      created_at: meal.createdAt,
    });
    if (error) throw error;
    setMeals((current) => [meal, ...current]);
  };

  const deleteMeal = async (id: string) => {
    const { error } = await supabase.from("meals").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMeals((current) => current.filter((meal) => meal.id !== id));
  };

  const dates = [...new Set(meals.map((meal) => getDateKey(meal.createdAt)))].sort((a, b) =>
    b.localeCompare(a),
  );
  const recentDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return getDateKey(date);
  });
  const calendarDates = [...new Set([...recentDates, ...dates])].sort((a, b) => b.localeCompare(a));
  const selectedMeals = meals.filter((meal) => getDateKey(meal.createdAt) === selectedDate);
  const totalKcal = selectedMeals.reduce((a, m) => a + m.calorias, 0);
  const totalProt = selectedMeals.reduce((a, m) => a + m.proteinas, 0);
  const todayKey = getDateKey(new Date());
  const selectedDateIsToday = selectedDate === todayKey;
  const selectedDateIsEmpty = selectedMeals.length === 0;
  const hasPreviousDay = (date: string) => {
    const previous = new Date(`${date}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    return dates.includes(getDateKey(previous));
  };
  let streak = 0;
  let streakDate = dates.includes(todayKey) ? todayKey : dates[0];
  while (streakDate && dates.includes(streakDate)) {
    streak += 1;
    if (!hasPreviousDay(streakDate)) break;
    const previous = new Date(`${streakDate}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    streakDate = getDateKey(previous);
  }

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
      const { imageBase64, mimeType } = splitDataUrl(image);
      let result;
      if (imageBase64) {
        const { data, error } = await supabase.functions.invoke("analizar-comida", {
          body: {
            imageBase64,
            descripcion: JSON.stringify({
              plato: description.trim(),
              detallesUsuario: settings.additionalDetails,
              nivelExigencia: settings.bodyAssessment?.nivelExigencia ?? "firme",
            }),
            mimeType,
          },
        });
        if (error) throw error;
        if (!data || typeof data.error === "string") {
          throw new Error(data?.error || "La función no devolvió un análisis válido.");
        }
        result = data;
      } else {
        result = await analyzeMealDemo(description.trim());
        toast("Modo demo: sube una foto para usar el análisis con IA.");
      }

      const meal: Meal = {
        id: crypto.randomUUID(),
        ...result,
        image: image ?? undefined,
        time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
      };
      await persistMeal(meal);
      setCoachMessage(result.comentarioEstricto);
      setImage(null);
      setDescription("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Algo salió mal con el análisis.");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (
    profile: ProfileInput,
    bodyPhoto: File | null,
    analyzedBodyAssessment?: BodyAssessment | null,
  ) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authenticatedUserId = session?.user.id ?? userId;
    if (!authenticatedUserId || !session) {
      throw new Error(
        "Tu cuenta todavía no tiene una sesión activa. Inicia sesión de nuevo antes de guardar el perfil.",
      );
    }
    const baseTargets = calculateTargets(profile);
    let bodyAssessment: BodyAssessment | undefined;
    let bodyPhotoPath: string | undefined;

    if (bodyPhoto) {
      bodyAssessment = analyzedBodyAssessment ?? (await analyzeBodyPhoto(bodyPhoto, profile));
      bodyPhotoPath = `${authenticatedUserId}/${crypto.randomUUID()}-${bodyPhoto.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("body-progress")
        .upload(bodyPhotoPath, bodyPhoto, { contentType: bodyPhoto.type, upsert: false });
      if (uploadError) throw uploadError;
    }
    const recommendedCalories = bodyAssessment?.recomendacionCalorias;
    const recommendedProteins = bodyAssessment?.recomendacionProteinas;
    const recommendedMaintenance = bodyAssessment?.mantenimientoCalorias;
    const next = {
      ...settings,
      ...profile,
      ...baseTargets,
      maintenanceCalories: recommendedMaintenance
        ? Math.max(1200, Math.min(5000, Math.round(recommendedMaintenance)))
        : baseTargets.maintenanceCalories,
      metaCalorias: recommendedCalories
        ? Math.max(1200, Math.min(5000, Math.round(recommendedCalories)))
        : baseTargets.metaCalorias,
      metaProteinas: recommendedProteins
        ? Math.max(40, Math.min(350, Math.round(recommendedProteins)))
        : baseTargets.metaProteinas,
      bodyAssessment,
      profileComplete: true,
    };
    const { error } = await supabase.from("profiles").upsert({
      id: authenticatedUserId,
      user_id: authenticatedUserId,
      name: profile.userName,
      age: profile.age,
      weight: profile.weight,
      height: profile.height,
      gender: profile.gender,
      activity: profile.activity,
      goals: profile.goals.join(","),
      additional_details: profile.additionalDetails,
      maintenance_calories: next.maintenanceCalories,
      target_calories: next.metaCalorias,
      target_proteins: next.metaProteinas,
      body_photo_path: bodyPhotoPath,
      body_assessment: bodyAssessment ?? null,
      body_assessment_created_at: bodyAssessment ? new Date().toISOString() : null,
    });
    if (error) throw error;
    setSettings({ ...next, bodyAssessment });
    saveSettings(next);
    if (bodyAssessment) toast.success(bodyAssessment.veredictoInicial);
    setView("app");
  };

  const analyzeBodyPhoto = async (bodyPhoto: File, profile: ProfileInput) => {
    const bodyPreview = await fileToBase64(bodyPhoto);
    const { imageBase64, mimeType } = splitDataUrl(bodyPreview);
    const { data, error } = await supabase.functions.invoke("analizar-comida", {
      body: {
        tipo: "cuerpo",
        imageBase64,
        mimeType,
        descripcion: JSON.stringify({
          edad: profile.age,
          pesoKg: profile.weight,
          alturaCm: profile.height,
          actividad: profile.activity,
          objetivos: profile.goals,
          caloriasBaseCalculadas: calculateTargets(profile).metaCalorias,
          mantenimientoBaseCalculado: calculateTargets(profile).maintenanceCalories,
          proteinasBaseCalculadas: calculateTargets(profile).metaProteinas,
          detallesAdicionales: profile.additionalDetails,
        }),
      },
    });
    if (error) throw error;
    if (!data || typeof data.error === "string") {
      throw new Error(data?.error || "No se pudo analizar la foto de referencia.");
    }
    return data as BodyAssessment;
  };

  if (view === "auth") {
    return (
      <AuthScreen
        onContinue={async (email, password, name, mode) => {
          const result =
            mode === "register"
              ? await supabase.auth.signUp({ email, password, options: { data: { name } } })
              : await supabase.auth.signInWithPassword({ email, password });
          if (result.error) throw result.error;
          if (!result.data.user) throw new Error("No se pudo crear la sesión.");
          if (!result.data.session) {
            throw new Error(
              "Cuenta creada. Revisa tu email para confirmarla y después inicia sesión.",
            );
          }
          setUserId(result.data.user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", result.data.user.id)
            .maybeSingle();
          const next = { ...settings, userName: profile?.name || name };
          setSettings(next);
          setView(profile?.age ? "app" : "onboarding");
        }}
      />
    );
  }

  if (view === "onboarding") {
    return (
      <OnboardingScreen
        settings={settings}
        onAnalyzeBody={analyzeBodyPhoto}
        onComplete={async (profile) => {
          try {
            await saveProfile(profile.values, profile.bodyPhoto, profile.bodyAssessment);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo guardar tu perfil.");
            throw error;
          }
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Fit<span className="text-primary text-glow">Judge</span> AI
            </h1>
            <div className="mt-2 flex max-w-full items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4 text-primary" />
              <span className="shrink-0 font-semibold text-foreground">
                {selectedDate === getDateKey(new Date()) ? "Hoy" : "Registro"}
              </span>
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
              <time className="truncate capitalize" dateTime={selectedDate}>
                {formatDate(selectedDate, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <div
              className={`flex flex-col items-center justify-center ${streak >= 2 ? "streak-active" : ""}`}
              title={`${streak} ${streak === 1 ? "día" : "días"} de racha`}
              aria-label={`${streak} ${streak === 1 ? "día" : "días"} de racha`}
            >
              <div className="relative flex size-10 items-center justify-center text-primary">
                <Flame className="size-9 fill-primary/15" />
                <span className="absolute inset-0 flex items-center justify-center pt-1 text-xs font-black text-foreground">
                  {streak}
                </span>
              </div>
              <span className="-mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Racha
              </span>
            </div>
            <SettingsDialog
              settings={settings}
              onEditProfile={() => setView("onboarding")}
              onSave={(s) => {
                setSettings(s);
                saveSettings(s);
                void supabase
                  .from("profiles")
                  .update({
                    name: s.userName,
                    age: s.age,
                    weight: s.weight,
                    height: s.height,
                    gender: s.gender,
                    activity: s.activity,
                    goals: s.goals.join(","),
                    additional_details: s.additionalDetails,
                    maintenance_calories: s.maintenanceCalories,
                    target_calories: s.metaCalorias,
                    target_proteins: s.metaProteinas,
                  })
                  .eq("user_id", userId)
                  .then(({ error }) => {
                    if (error) toast.error(error.message);
                    else toast.success("Ajustes guardados.");
                  });
              }}
            />
            <Button variant="outline" size="sm" onClick={() => void supabase.auth.signOut()}>
              <LogOut className="size-4" /> <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <button
            type="button"
            aria-expanded={daysExpanded}
            title={daysExpanded ? "Minimizar historial de días" : "Mostrar historial de días"}
            onClick={() => setDaysExpanded((expanded) => !expanded)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-sm font-bold">Tus días</p>
              <p className="text-xs text-muted-foreground">
                {daysExpanded
                  ? "Pulsa una fecha para consultar todo lo que registraste."
                  : formatDate(selectedDate, { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {daysExpanded ? (
                <ChevronDown className="size-5" />
              ) : (
                <CalendarDays className="size-5" />
              )}
            </span>
          </button>
          {daysExpanded && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {calendarDates.map((date) => {
                const isSelected = selectedDate === date;
                const dateMeals = meals.filter((meal) => getDateKey(meal.createdAt) === date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`min-w-28 shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/60"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">
                      {date === getDateKey(new Date())
                        ? "Hoy"
                        : formatDate(date, { weekday: "short" })}
                    </span>
                    <span className="mt-1 block text-sm font-bold">
                      {formatDate(date, { day: "numeric", month: "short" })}
                    </span>
                    <span className="mt-1 block text-xs opacity-80">
                      {dateMeals.length} {dateMeals.length === 1 ? "comida" : "comidas"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <ProgressCard
            label="Mantenimiento estimado"
            current={settings.maintenanceCalories}
            goal={settings.maintenanceCalories}
            unit="kcal/día"
            icon={<Flame className="size-4" />}
          />
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

        {selectedDateIsEmpty && (
          <section
            className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${
              selectedDateIsToday
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">
                {selectedDateIsToday ? "Ningún registro todavía" : "Día sin registro"}
              </p>
              <p className="mt-1 text-sm">
                {selectedDateIsToday
                  ? "El entrenador espera tu primer plato. Calorías y proteínas siguen en 0."
                  : "Ningún plato registrado. ¿Ayuno o vergüenza de mostrar lo que has comido?"}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {selectedDateIsToday
                  ? "La evaluación final se calculará cuando termine el día."
                  : "Calorías y proteínas: 0. Este día no suma a tu racha."}
              </p>
            </div>
          </section>
        )}

        <section className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {selectedDateIsToday ? "Evaluación del día" : "Evaluación final"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedDateIsToday
                ? "Estará disponible cuando termine el día."
                : "Evaluación calculada con todas las comidas de este día."}
            </p>
          </div>
          {selectedDateIsToday ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
              Pendiente
            </span>
          ) : (
            <strong className="text-3xl font-black text-primary">
              {Math.round(
                Math.min(1, totalKcal / Math.max(settings.metaCalorias, 1)) * 5 +
                  Math.min(1, totalProt / Math.max(settings.metaProteinas, 1)) * 5,
              )}
              <span className="text-base text-muted-foreground">/10</span>
            </strong>
          )}
        </section>

        {settings.bodyAssessment && (
          <section className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Tu punto de partida
                </p>
                <h2 className="mt-1 text-lg font-black">Veredicto inicial</h2>
              </div>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                Confianza {settings.bodyAssessment.confianza}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold">{settings.bodyAssessment.veredictoInicial}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-background p-3 text-sm">
                <span className="block text-xs text-muted-foreground">Calorías recomendadas</span>
                <strong>
                  {settings.bodyAssessment.recomendacionCalorias ?? settings.metaCalorias} kcal/día
                </strong>
              </div>
              <div className="rounded-lg bg-background p-3 text-sm">
                <span className="block text-xs text-muted-foreground">Proteína recomendada</span>
                <strong>
                  {settings.bodyAssessment.recomendacionProteinas ?? settings.metaProteinas} g/día
                </strong>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <span className="block text-xs text-muted-foreground">Composición visual</span>
                <span className="font-medium">{settings.bodyAssessment.composicionVisual}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Nivel muscular visual</span>
                <span className="font-medium">{settings.bodyAssessment.nivelMuscularVisual}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Postura observada</span>
                <span className="font-medium">{settings.bodyAssessment.posturaObservada}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {settings.bodyAssessment.limitaciones}
            </p>
          </section>
        )}

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
            Historial del {formatDate(selectedDate, { day: "numeric", month: "long" })}
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

            {selectedMeals.map((meal) => (
              <article
                key={meal.id}
                className="card-heat flex items-start gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4"
              >
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
                    <h3 className="min-w-0 truncate font-semibold">{meal.nombreComida}</h3>
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
                  onClick={() => void deleteMeal(meal.id)}
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

function AuthScreen({
  onContinue,
}: {
  onContinue: (
    email: string,
    password: string,
    name: string,
    mode: "login" | "register",
  ) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("register");
  const [loading, setLoading] = useState(false);
  const valid = email.trim() && password.length >= 6 && (mode === "login" || name.trim());

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Toaster />
      <div className="w-full max-w-md">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-primary">FitJudge AI</p>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
          Tu nutrición, con números y criterio.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Registra tu punto de partida y convierte cada plato en una decisión mejor.
        </p>
        <div className="card-heat mt-8 rounded-2xl p-6">
          <div className="flex border-b border-border">
            {(["register", "login"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`flex-1 border-b-2 pb-3 text-sm font-bold ${
                  mode === item
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {item === "register" ? "Crear cuenta" : "Iniciar sesión"}
              </button>
            ))}
          </div>
          <label className="mt-6 block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            className="mt-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
          {mode === "register" && (
            <>
              <label className="mt-4 block text-sm font-medium" htmlFor="name">
                ¿Cómo te llamamos?
              </label>
              <Input
                id="name"
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
              />
            </>
          )}
          <label className="mt-4 block text-sm font-medium" htmlFor="password">
            Contraseña
          </label>
          <Input
            id="password"
            className="mt-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={!valid || loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onContinue(email.trim(), password, name.trim(), mode);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading
              ? "Conectando..."
              : mode === "register"
                ? "Crear mi cuenta"
                : "Entrar en FitJudge"}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Tu perfil y tus comidas se guardan de forma segura en tu cuenta.
          </p>
        </div>
      </div>
    </main>
  );
}

function OnboardingScreen({
  settings,
  onAnalyzeBody,
  onComplete,
}: {
  settings: Settings;
  onAnalyzeBody: (photo: File, profile: ProfileInput) => Promise<BodyAssessment>;
  onComplete: (profile: {
    values: ProfileInput;
    bodyPhoto: File | null;
    bodyAssessment: BodyAssessment | null;
  }) => Promise<void>;
}) {
  const [bodyPhoto, setBodyPhoto] = useState<File | null>(null);
  const [bodyPreview, setBodyPreview] = useState<string | null>(null);
  const [bodyAssessment, setBodyAssessment] = useState<BodyAssessment | null>(null);
  const [analyzingBody, setAnalyzingBody] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileInput>({
    userName: settings.userName,
    age: settings.age,
    weight: settings.weight,
    height: settings.height,
    gender: settings.gender,
    activity: settings.activity,
    goals: settings.goals,
    additionalDetails: settings.additionalDetails,
  });
  const update = (patch: Partial<ProfileInput>) =>
    setProfile((current) => ({ ...current, ...patch }));
  const valid =
    profile.age > 0 && profile.weight > 0 && profile.height > 0 && profile.goals.length > 0;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <Toaster />
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-primary">Tu perfil</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          Ajustemos tu punto de partida, {settings.userName}.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Calcularemos tus objetivos y, si quieres, crearemos una referencia visual privada para
          medir tu progreso.
        </p>
        <div className="card-heat mt-8 space-y-7 rounded-2xl p-5 sm:p-8">
          <div className="space-y-2">
            <label htmlFor="additional-details" className="text-sm font-medium">
              Otros detalles para personalizar tu plan
            </label>
            <Textarea
              id="additional-details"
              value={profile.additionalDetails}
              onChange={(event) => update({ additionalDetails: event.target.value })}
              placeholder="Ej.: horarios, alimentos que no comes, lesiones, experiencia entrenando o cualquier detalle importante"
              className="min-h-24"
            />
            <p className="text-xs text-muted-foreground">
              Se guardará en tu perfil y la IA lo tendrá en cuenta junto con tus datos.
            </p>
          </div>
          <section className="rounded-xl border border-border bg-background/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Camera className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">Foto de referencia corporal</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opcional. Se guarda privada y sirve para observar tu evolución, no para
                  diagnosticar tu salud.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => bodyInputRef.current?.click()}
              className="mt-4 flex min-h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-border p-3 transition-colors hover:border-primary/60"
            >
              {bodyPreview ? (
                <img
                  src={bodyPreview}
                  alt="Vista previa de la foto corporal"
                  className="max-h-56 rounded-md object-contain"
                />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  Subir una foto de cuerpo completo
                </span>
              )}
            </button>
            <input
              ref={bodyInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
                setBodyPhoto(file);
                setBodyPreview(await fileToBase64(file));
                setAnalyzingBody(true);
                try {
                  setBodyAssessment(await onAnalyzeBody(file, profile));
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "No se pudo analizar la foto.",
                  );
                  setBodyAssessment(null);
                } finally {
                  setAnalyzingBody(false);
                }
                event.target.value = "";
              }}
            />
            {analyzingBody && (
              <p className="mt-3 text-sm text-muted-foreground">
                La IA está preparando tus recomendaciones...
              </p>
            )}
            {bodyAssessment && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Resultados del juicio
                </p>
                <p className="mt-2 text-sm font-semibold">{bodyAssessment.veredictoInicial}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <p className="rounded-lg bg-background p-3 text-sm">
                    <span className="block text-xs text-muted-foreground">
                      Calorías recomendadas
                    </span>
                    <strong>
                      {bodyAssessment.recomendacionCalorias ??
                        calculateTargets(profile).metaCalorias}{" "}
                      kcal/día
                    </strong>
                  </p>
                  <p className="rounded-lg bg-background p-3 text-sm">
                    <span className="block text-xs text-muted-foreground">
                      Proteína recomendada
                    </span>
                    <strong>
                      {bodyAssessment.recomendacionProteinas ??
                        calculateTargets(profile).metaProteinas}{" "}
                      g/día
                    </strong>
                  </p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{bodyAssessment.limitaciones}</p>
              </div>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["age", "Edad", "años"],
                ["weight", "Peso", "kg"],
                ["height", "Altura", "cm"],
              ] as const
            ).map(([key, label, unit]) => (
              <label key={key} className="text-sm font-medium">
                {label}
                <div className="relative mt-2">
                  <Input
                    type="number"
                    min="1"
                    value={profile[key]}
                    onChange={(e) => update({ [key]: Number(e.target.value) })}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                    {unit}
                  </span>
                </div>
              </label>
            ))}
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Género</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["female", "Mujer"],
                  ["male", "Hombre"],
                  ["other", "Otro"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ gender: value })}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium ${
                    profile.gender === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Actividad habitual</legend>
            <div className="mt-3 space-y-2">
              {activityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update({ activity: option.value })}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${
                    profile.activity === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </span>
                  {profile.activity === option.value && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">
              ¿Qué quieres conseguir?{" "}
              <span className="font-normal text-muted-foreground">Puedes elegir varios</span>
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {goalOptions.map((goal) => {
                const selected = profile.goals.includes(goal.value);
                return (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() =>
                      update({
                        goals: selected
                          ? profile.goals.filter((item) => item !== goal.value)
                          : [...profile.goals, goal.value],
                      })
                    }
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm font-semibold ${
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    <span
                      className={`flex size-5 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {selected && <Check className="size-3" />}
                    </span>
                    {goal.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button
            className="w-full"
            size="lg"
            disabled={!valid || saving || analyzingBody}
            onClick={async () => {
              setSaving(true);
              try {
                await onComplete({ values: profile, bodyPhoto, bodyAssessment });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Preparando tu punto de partida..." : "Crear mi punto de partida"}
          </Button>
        </div>
      </div>
    </main>
  );
}

import { useState } from "react";
import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { activityOptions, calculateTargets, goalOptions, type Settings } from "@/lib/fitjudge";

export function SettingsDialog({
  settings,
  onSave,
  onEditProfile,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onEditProfile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(settings);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Settings2 className="size-4" /> Ajustes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
          <DialogDescription>
            Aquí ajustas tus objetivos. La clave de ChatGPT no se guarda en el navegador: la IA usa
            el secreto OPENAI_API_KEY configurado en Supabase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-details">Detalles para personalizar tu plan</Label>
            <Textarea
              id="settings-details"
              value={draft.additionalDetails}
              onChange={(e) => setDraft({ ...draft, additionalDetails: e.target.value })}
              placeholder="Horarios, alimentos que no comes, lesiones o cualquier detalle importante"
              className="min-h-20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="settings-age">Edad</Label>
              <Input
                id="settings-age"
                type="number"
                min="1"
                value={draft.age}
                onChange={(e) => setDraft({ ...draft, age: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-weight">Peso (kg)</Label>
              <Input
                id="settings-weight"
                type="number"
                min="1"
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-height">Altura (cm)</Label>
              <Input
                id="settings-height"
                type="number"
                min="1"
                value={draft.height}
                onChange={(e) => setDraft({ ...draft, height: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-gender">Género</Label>
              <select
                id="settings-gender"
                value={draft.gender}
                onChange={(e) =>
                  setDraft({ ...draft, gender: e.target.value as Settings["gender"] })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="female">Mujer</option>
                <option value="male">Hombre</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-activity">Actividad habitual</Label>
              <select
                id="settings-activity"
                value={draft.activity}
                onChange={(e) =>
                  setDraft({ ...draft, activity: e.target.value as Settings["activity"] })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {activityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Preferencias y objetivos</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {goalOptions.map((goal) => {
                const selected = draft.goals.includes(goal.value);
                return (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        goals: selected
                          ? draft.goals.filter((item) => item !== goal.value)
                          : [...draft.goals, goal.value],
                      })
                    }
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {goal.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="maintenance">Mantenimiento (kcal)</Label>
              <Input
                id="maintenance"
                type="number"
                value={draft.maintenanceCalories}
                onChange={(e) =>
                  setDraft({ ...draft, maintenanceCalories: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kcal">Meta de calorías</Label>
              <Input
                id="kcal"
                type="number"
                value={draft.metaCalorias}
                onChange={(e) => setDraft({ ...draft, metaCalorias: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prot">Meta de proteínas (g)</Label>
              <Input
                id="prot"
                type="number"
                value={draft.metaProteinas}
                onChange={(e) => setDraft({ ...draft, metaProteinas: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              onEditProfile();
            }}
          >
            Editar perfil completo
          </Button>
          <Button
            onClick={() => {
              onSave({
                ...draft,
                ...calculateTargets(draft),
                profileComplete: true,
              });
              setOpen(false);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import type { Settings } from "@/lib/fitjudge";

export function SettingsDialog({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
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
            Tu clave se guarda solo en este navegador. Sin clave, la app funciona en modo demo con
            valores simulados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">OpenAI API Key</Label>
            <Input
              id="key"
              type="password"
              placeholder="sk-..."
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            onClick={() => {
              onSave(draft);
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

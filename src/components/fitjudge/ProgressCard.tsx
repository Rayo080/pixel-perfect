import { cn } from "@/lib/utils";

type Props = {
  label: string;
  current: number;
  goal: number;
  unit: string;
  overIsBad?: boolean;
  icon: React.ReactNode;
};

export function ProgressCard({ label, current, goal, unit, overIsBad = true, icon }: Props) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const over = current > goal;
  const bad = over && overIsBad;
  const done = !overIsBad && current >= goal;

  return (
    <div className="card-heat rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:text-sm sm:tracking-widest">
          <span className="text-primary">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            bad
              ? "bg-destructive/15 text-destructive"
              : done
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
          )}
        >
          {Math.round((current / (goal || 1)) * 100)}%
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {Math.round(current)}
        </span>
        <span className="text-sm text-muted-foreground">
          / {goal} {unit}
        </span>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            bad ? "bg-destructive" : done ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {bad
          ? `Te has pasado ${Math.round(current - goal)} ${unit}. El entrenador lo ha visto.`
          : `Te faltan ${Math.max(0, Math.round(goal - current))} ${unit}.`}
      </p>
    </div>
  );
}

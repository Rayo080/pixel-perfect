import coach from "@/assets/coach.jpg";

export function CoachBubble({ message, thinking }: { message: string; thinking: boolean }) {
  return (
    <div className="card-heat flex items-center gap-4 rounded-2xl p-5">
      <img
        src={coach}
        alt="El Entrenador Estricto"
        width={768}
        height={768}
        className="h-20 w-20 shrink-0 rounded-2xl border border-border object-cover"
      />
      <div className="relative flex-1 rounded-2xl border border-border bg-secondary/60 p-4">
        <span className="absolute -left-1.5 top-8 h-3 w-3 rotate-45 border-b border-l border-border bg-secondary/60" />
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          El Entrenador Estricto
        </p>
        {thinking ? (
          <p className="mt-1 animate-pulse text-sm text-muted-foreground">
            Analizando plato con desaprobación...
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

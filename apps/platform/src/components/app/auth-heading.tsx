export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-9 space-y-2.5 text-center">
      <h1 className="font-display text-[2.25rem] leading-[1.1] font-medium tracking-[-0.025em]">{title}</h1>
      {subtitle && <p className="text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

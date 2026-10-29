export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 space-y-2 text-center">
      <h1 className="font-display text-[2rem] leading-tight font-medium tracking-[-0.02em]">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
    </div>
  );
}

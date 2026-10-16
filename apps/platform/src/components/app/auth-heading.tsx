export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
    </div>
  );
}

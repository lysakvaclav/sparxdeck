import { cn } from "@/lib/utils";

/** Blueprint spinner: a grey track with a rotating arc in the current colour. */
export function Spinner({
  size = 20,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  const stroke = Math.min(16, 400 / size);
  const circle = "M 50,50 m 0,-45 a 45,45 0 1 1 0,90 a 45,45 0 1 1 0,-90";
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={cn("inline-flex text-muted-foreground", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden
        className="animate-spin [animation-duration:500ms]"
      >
        <path d={circle} fill="none" stroke="rgb(92 112 128 / 0.2)" strokeWidth={stroke} />
        <path
          d={circle}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="282.7 282.7"
          strokeDashoffset="212"
        />
      </svg>
    </span>
  );
}

"use client";

import * as React from "react";
import { CrossIcon, TickCircleIcon, WarningSignIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * Blueprint toaster: short confirmations at the top centre ("Link copied").
 * Announced to screen readers; dismissed after a few seconds or by the cross.
 */

type ToastIntent = "none" | "success" | "danger";
type ToastItem = { id: number; message: string; intent: ToastIntent };

const ToastContext = React.createContext<(message: string, intent?: ToastIntent) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({
  children,
  closeLabel,
}: {
  children: React.ReactNode;
  closeLabel: string;
}) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = React.useCallback(
    (message: string, intent: ToastIntent = "none") => {
      nextId.current += 1;
      const id = nextId.current;
      setItems((current) => [...current.slice(-2), { id, message, intent }]);
      window.setTimeout(() => dismiss(id), 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2.5 px-3"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex min-h-10 max-w-md animate-in items-center gap-2.5 rounded-md ps-3 pe-[5px] text-ui shadow-elevation-3 fade-in-0 slide-in-from-top-2",
              item.intent === "success"
                ? "bg-success text-white"
                : item.intent === "danger"
                  ? "bg-destructive text-white"
                  : "bg-popover text-popover-foreground",
            )}
          >
            {item.intent === "success" && <TickCircleIcon />}
            {item.intent === "danger" && <WarningSignIcon />}
            <span className="min-w-0 flex-1 py-2">{item.message}</span>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => dismiss(item.id)}
              className={cn(
                "flex size-[30px] shrink-0 items-center justify-center rounded-sm",
                item.intent !== "none"
                  ? "hover:bg-white/15"
                  : "text-[var(--btn-icon)] hover:bg-accent",
              )}
            >
              <CrossIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

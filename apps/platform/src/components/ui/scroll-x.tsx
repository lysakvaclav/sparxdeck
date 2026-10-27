"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontally scrolling box that joins the tab order only while its content
 * is wider than it, so keyboard users can scroll it with the arrow keys.
 */
export function ScrollX({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => setScrolls(box.scrollWidth > box.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={scrolls ? 0 : undefined}
      className={cn(
        "overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

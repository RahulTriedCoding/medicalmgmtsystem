"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = (theme === "system" ? resolvedTheme : theme) ?? undefined;

  if (!currentTheme) {
    return (
      <button
        type="button"
        className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted-foreground"
        aria-label="Toggle theme"
      >
        ...
      </button>
    );
  }

  const isDark = currentTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        isDark
          ? "border-cyan-400/40 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-cyan-300"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-500"
      )}
      aria-label="Toggle theme"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="uppercase tracking-[0.2em]">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}

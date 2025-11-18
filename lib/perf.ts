const perfEnabled = process.env.NODE_ENV !== "production";

function uniqueLabel(label: string) {
  const suffix = `${performance.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return `${label}#${suffix}`;
}

export function startPerf(label: string): string | null {
  if (!perfEnabled) return null;
  const timerLabel = uniqueLabel(label);
  console.time(timerLabel);
  return timerLabel;
}

export function endPerf(timerLabel?: string | null) {
  if (!perfEnabled || !timerLabel) return;
  console.timeEnd(timerLabel);
}

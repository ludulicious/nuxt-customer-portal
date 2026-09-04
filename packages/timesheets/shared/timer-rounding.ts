export const roundTimerMinutes = (elapsedMs: number, increment: number) =>
  Math.max(1, Math.ceil(elapsedMs / (increment * 60_000))) * increment

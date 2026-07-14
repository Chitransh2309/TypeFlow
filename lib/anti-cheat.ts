// Pure, stateless result-scoring/validation helpers shared by the socket-server's
// result:submit handler. Deliberately pragmatic (plausibility checks against the
// server's own clock + last known progress), not a full keystroke-replay system.

export const WPM_CEILING = 300; // comfortably above the ~216 WPM world record
export const MIN_ELAPSED_MS = 1000; // no configured test can be finished faster than this

export function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), max));
}

export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (correctChars / 5) / (elapsedMs / 60000);
}

export function computeAccuracy(correctChars: number, charsTyped: number): number {
  if (charsTyped <= 0) return 100;
  return Math.max(0, Math.min(100, (correctChars / charsTyped) * 100));
}

export interface ScoreResultInput {
  charsTyped: number;
  correctChars: number;
  elapsedMs: number; // server-measured: Date.now() - roomState.startedAtMs
  testTextLength: number;
  lastKnownCharIndex: number; // last charIndex seen from this user's progress:send events
}

export interface ScoreResultOutput {
  charsTyped: number;
  correctChars: number;
  elapsedTime: number; // seconds
  wpm: number;
  accuracy: number;
  flagged: boolean;
  rejected: boolean;
  rejectReason?: string;
}

export function scoreResult(input: ScoreResultInput): ScoreResultOutput {
  const charsTyped = clampCount(input.charsTyped, input.testTextLength);
  const correctChars = clampCount(input.correctChars, charsTyped);

  if (input.elapsedMs < MIN_ELAPSED_MS) {
    return {
      charsTyped,
      correctChars,
      elapsedTime: input.elapsedMs / 1000,
      wpm: 0,
      accuracy: 0,
      flagged: false,
      rejected: true,
      rejectReason: "elapsed time is implausibly short",
    };
  }

  // Reported progress shouldn't regress far below what we already observed
  // via progress:send, nor claim more than the text actually contains.
  if (charsTyped < input.lastKnownCharIndex - 5) {
    return {
      charsTyped,
      correctChars,
      elapsedTime: input.elapsedMs / 1000,
      wpm: 0,
      accuracy: 0,
      flagged: false,
      rejected: true,
      rejectReason: "reported progress regressed from last known progress",
    };
  }

  const wpm = computeWpm(correctChars, input.elapsedMs);
  const accuracy = computeAccuracy(correctChars, charsTyped);
  const flagged = wpm > WPM_CEILING;

  return {
    charsTyped,
    correctChars,
    elapsedTime: input.elapsedMs / 1000,
    wpm: Math.round(wpm),
    accuracy,
    flagged,
    rejected: false,
  };
}

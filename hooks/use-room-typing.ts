"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface CharState {
  char: string;
  state: "correct" | "incorrect" | "current" | "upcoming";
}

interface UseRoomTypingOptions {
  testText: string;
  // Server clock (ms since epoch) the contest actually started at - shared by
  // every participant, so the countdown/elapsed clock is identical for
  // everyone and starts the instant the contest starts, not whenever each
  // person happens to type their first character.
  contestStartMs: number;
  roomId: string;
  onProgress: (data: { charIndex: number; wpm: number; accuracy: number }) => void;
  onFinished: (data: { charsTyped: number; correctChars: number }) => void;
}

interface StoredTypingProgress {
  currentWordIndex: number;
  currentCharIndex: number;
  typedChars: string[][];
}

const PROGRESS_DEBOUNCE_MS = 200;

// Namespaced by contestStartMs (not just roomId) so a later contest in the
// same room never rehydrates a previous one's leftover typed progress.
function progressStorageKey(roomId: string, contestStartMs: number): string {
  return `room:typingProgress:${roomId}:${contestStartMs}`;
}

function readStoredProgress(storageKey: string): StoredTypingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredTypingProgress) : null;
  } catch {
    return null;
  }
}

// Same word/char-state model as hooks/use-typing-test.ts (so the room contest
// can reuse components/typing/typing-area.tsx as-is), but driven by a fixed,
// server-provided testText instead of locally-generated words/config, and
// reporting progress/completion via callbacks instead of local test-history.
export function useRoomTyping({
  testText,
  contestStartMs,
  roomId,
  onProgress,
  onFinished,
}: UseRoomTypingOptions) {
  const words = useMemo(() => (testText ? testText.split(" ") : []), [testText]);
  const storageKey = useMemo(
    () => progressStorageKey(roomId, contestStartMs),
    [roomId, contestStartMs]
  );

  // Rehydrates once, synchronously, from whatever was typed before a refresh
  // - a lazy initializer only runs on mount, so this can't clobber later
  // keystrokes.
  const restoredRef = useRef<StoredTypingProgress | null>(null);
  if (restoredRef.current === null) {
    restoredRef.current = readStoredProgress(storageKey) ?? {
      currentWordIndex: 0,
      currentCharIndex: 0,
      typedChars: [],
    };
  }
  const restored = restoredRef.current;
  const hadRestoredProgress = restored.currentWordIndex > 0 || restored.currentCharIndex > 0;

  const [currentWordIndex, setCurrentWordIndex] = useState(restored.currentWordIndex);
  const [currentCharIndex, setCurrentCharIndex] = useState(restored.currentCharIndex);
  const [typedChars, setTypedChars] = useState<string[][]>(restored.typedChars);
  const [isActive, setIsActive] = useState(hadRestoredProgress);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(() =>
    Math.max(0, Math.floor((Date.now() - contestStartMs) / 1000))
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedFiredRef = useRef(false);

  // Flat char accounting against the original testText string (word lengths +
  // one space between each word) - must agree with the server's anti-cheat,
  // which clamps against testText.length the same way.
  const computeFlatCounts = useCallback(() => {
    let charsTyped = 0;
    let correctChars = 0;

    for (let i = 0; i < currentWordIndex; i++) {
      const word = words[i] || "";
      const typed = typedChars[i] || [];
      for (let c = 0; c < word.length; c++) {
        charsTyped++;
        if (typed[c] === word[c]) correctChars++;
      }
      if (typed.length > word.length) {
        charsTyped += typed.length - word.length; // over-typed extra chars, all incorrect
      }
      charsTyped++; // the space separating this word from the next
      correctChars++; // fixed separator - always "correct"
    }

    const currentWord = words[currentWordIndex] || "";
    const currentTyped = typedChars[currentWordIndex] || [];
    for (let c = 0; c < currentCharIndex; c++) {
      charsTyped++;
      if (currentTyped[c] === currentWord[c]) correctChars++;
    }

    return { charsTyped, correctChars };
  }, [words, typedChars, currentWordIndex, currentCharIndex]);

  const getStats = useCallback(() => {
    const { charsTyped, correctChars } = computeFlatCounts();
    const minutes = Math.max(elapsedTime / 60, 1 / 60);
    const wpm = Math.round(correctChars / 5 / minutes);
    const accuracy = charsTyped > 0 ? Math.round((correctChars / charsTyped) * 100) : 100;
    return { wpm, accuracy, charsTyped, correctChars };
  }, [computeFlatCounts, elapsedTime]);

  // Ticks from the shared server-anchored start, not from the user's first
  // keystroke - runs immediately regardless of isActive so the clock is
  // already correct (and identical across participants) the moment the
  // contest starts, whether or not this user has typed anything yet.
  useEffect(() => {
    if (isFinished) return;
    const update = () => setElapsedTime(Math.max(0, Math.floor((Date.now() - contestStartMs) / 1000)));
    update();
    timerRef.current = setInterval(update, 200);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [contestStartMs, isFinished]);

  useEffect(() => {
    return () => {
      if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // getStats/onProgress change identity on every tick (getStats depends on
  // elapsedTime) - read them via refs inside the heartbeat below so the
  // interval itself doesn't get torn down and restarted before it ever fires.
  const getStatsRef = useRef(getStats);
  getStatsRef.current = getStats;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  // Keystrokes are the only thing that broadcasts progress, so someone who
  // stops typing mid-contest freezes at their last reported wpm for every
  // other participant, even though the elapsed clock (and this user's own
  // wpm display) keeps ticking and their true rate keeps dropping. Re-send on
  // a fixed cadence too, so everyone else sees the same decay live.
  useEffect(() => {
    if (!isActive || isFinished) return;
    const interval = setInterval(() => {
      const { wpm, accuracy, charsTyped } = getStatsRef.current();
      onProgressRef.current({ charIndex: charsTyped, wpm, accuracy });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, isFinished]);

  // Persists on every keystroke so a refresh can rehydrate exactly what was
  // typed - skipped while nothing's been typed yet so mounting doesn't write
  // an empty record over a still-valid one (e.g. a remount before the first
  // keystroke).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentWordIndex === 0 && currentCharIndex === 0 && typedChars.length === 0) return;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ currentWordIndex, currentCharIndex, typedChars })
    );
  }, [storageKey, currentWordIndex, currentCharIndex, typedChars]);

  const finishTyping = useCallback(() => {
    if (finishedFiredRef.current) return;
    finishedFiredRef.current = true;
    setIsActive(false);
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (typeof window !== "undefined") sessionStorage.removeItem(storageKey);
    const { charsTyped, correctChars } = computeFlatCounts();
    onFinished({ charsTyped, correctChars });
  }, [computeFlatCounts, onFinished, storageKey]);

  const sendProgressDebounced = useCallback(() => {
    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = setTimeout(() => {
      const { wpm, accuracy, charsTyped } = getStats();
      onProgress({ charIndex: charsTyped, wpm, accuracy });
    }, PROGRESS_DEBOUNCE_MS);
  }, [getStats, onProgress]);

  // If this mount rehydrated in-progress typing (i.e. this is a refresh
  // mid-contest), tell the server right away instead of waiting for the next
  // keystroke - otherwise its last-known-progress (used for DNF-fallback
  // scoring if this tab disconnects again) stays stale at wherever it was
  // before the refresh.
  useEffect(() => {
    if (hadRestoredProgress) sendProgressDebounced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isFinished || words.length === 0) return;

      if (!isActive && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
        setIsActive(true);
      }

      const currentWord = words[currentWordIndex];
      if (!currentWord) return;

      if (e.key === " ") {
        e.preventDefault();
        if (currentCharIndex > 0) {
          if (currentWordIndex === words.length - 1) {
            finishTyping();
            return;
          }
          setCurrentWordIndex((prev) => prev + 1);
          setCurrentCharIndex(0);
          sendProgressDebounced();
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (currentCharIndex > 0) {
          setCurrentCharIndex((prev) => prev - 1);
          setTypedChars((prev) => {
            const next = [...prev];
            if (next[currentWordIndex]) {
              next[currentWordIndex] = next[currentWordIndex].slice(0, -1);
            }
            return next;
          });
        } else if (currentWordIndex > 0) {
          setCurrentWordIndex((prev) => prev - 1);
          const prevTyped = typedChars[currentWordIndex - 1] || [];
          setCurrentCharIndex(prevTyped.length);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (currentCharIndex >= currentWord.length + 5) return;
        setTypedChars((prev) => {
          const next = [...prev];
          if (!next[currentWordIndex]) next[currentWordIndex] = [];
          next[currentWordIndex] = [...next[currentWordIndex], e.key];
          return next;
        });
        setCurrentCharIndex((prev) => prev + 1);
        sendProgressDebounced();
      }
    },
    [
      words,
      currentWordIndex,
      currentCharIndex,
      isActive,
      isFinished,
      typedChars,
      finishTyping,
      sendProgressDebounced,
    ]
  );

  const getCharStates = useCallback((): CharState[][] => {
    return words.map((word, wordIdx) => {
      const typed = typedChars[wordIdx] || [];
      const chars = word.split("").map((char, charIdx) => {
        if (wordIdx < currentWordIndex) {
          if (charIdx < typed.length) {
            return { char, state: typed[charIdx] === char ? "correct" : "incorrect" } as CharState;
          }
          return { char, state: "incorrect" } as CharState;
        } else if (wordIdx === currentWordIndex) {
          if (charIdx < currentCharIndex) {
            return { char, state: typed[charIdx] === char ? "correct" : "incorrect" } as CharState;
          } else if (charIdx === currentCharIndex) {
            return { char, state: "current" } as CharState;
          }
          return { char, state: "upcoming" } as CharState;
        }
        return { char, state: "upcoming" } as CharState;
      });

      if (typed.length > word.length) {
        for (let i = word.length; i < typed.length; i++) {
          chars.push({ char: typed[i], state: "incorrect" });
        }
      }

      return chars;
    });
  }, [words, typedChars, currentWordIndex, currentCharIndex]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const getProgress = useCallback(() => {
    const { charsTyped } = computeFlatCounts();
    return testText.length > 0 ? Math.min(100, (charsTyped / testText.length) * 100) : 0;
  }, [computeFlatCounts, testText.length]);

  const { wpm, accuracy } = getStats();

  return {
    words,
    charStates: getCharStates(),
    currentWordIndex,
    currentCharIndex,
    isActive,
    isFinished,
    elapsedTime,
    wpm,
    accuracy,
    progress: getProgress(),
    inputRef,
    handleKeyDown,
    focusInput,
  };
}

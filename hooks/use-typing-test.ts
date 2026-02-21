"use client";

import React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { getRandomWords, getRandomQuote } from "@/lib/words-data";
import { loadSettings, type UserSettings, DEFAULT_SETTINGS} from "@/lib/settings-store";
import { initTypingSound, playTypingSound } from "./typing-sound";

export type TestMode = "time" | "words" | "quote";
export type Difficulty = "easy" | "medium" | "hard";

interface TestConfig {
  mode: TestMode;
  timeLimit?: number;
  wordCount?: number;
  difficulty: Difficulty;
}

interface TestStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalChars: number;
  elapsedTime: number;
  consistency: number;
}

interface CharState {
  char: string;
  state: "correct" | "incorrect" | "current" | "upcoming";
}

export function useTypingTest(config: TestConfig) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [typedChars, setTypedChars] = useState<string[][]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [stats, setStats] = useState<TestStats | null>(null);
  const [wpmHistory, setWpmHistory] = useState<number[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastWpmUpdateRef = useRef<number>(-1);

  // Generate words locally
  const generateWords = useCallback(() => {
    if (config.mode === "quote") {
      const quote = getRandomQuote(config.difficulty);
      setWords(quote.text.split(" "));
    } else {
      const wordCount = config.mode === "words" ? (config.wordCount || 50) : 100;
      setWords(getRandomWords(wordCount, config.difficulty));
    }
  }, [config.mode, config.difficulty, config.wordCount]);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    initTypingSound();
  }, []);

  // Initialize test
  useEffect(() => {
    generateWords();
  }, [generateWords]);

  // Reset test
  const resetTest = useCallback(() => {
    setCurrentWordIndex(0);
    setCurrentCharIndex(0);
    setTypedChars([]);
    setIsActive(false);
    setIsFinished(false);
    setStartTime(null);
    setElapsedTime(0);
    setStats(null);
    setWpmHistory([]);
    lastWpmUpdateRef.current = -1;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    generateWords();
  }, [generateWords]);

  // Calculate stats
  const calculateStats = useCallback((): TestStats => {
    const allTyped = typedChars.flat();
    let correctChars = 0;
    let incorrectChars = 0;

    words.slice(0, currentWordIndex + (currentCharIndex > 0 ? 1 : 0)).forEach((word, wordIdx) => {
      const typed = typedChars[wordIdx] || [];
      word.split("").forEach((char, charIdx) => {
        if (typed[charIdx] === char) {
          correctChars++;
        } else if (typed[charIdx] !== undefined) {
          incorrectChars++;
        }
      });
      // Count extra characters as incorrect
      if (typed.length > word.length) {
        incorrectChars += typed.length - word.length;
      }
    });

    const totalChars = correctChars + incorrectChars;
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
    const timeInMinutes = Math.max(elapsedTime / 60, 1 / 60);
    const wpm = Math.round((correctChars / 5) / timeInMinutes);
    const rawWpm = Math.round((allTyped.length / 5) / timeInMinutes);

    // Calculate consistency (standard deviation of WPM)
    const avgWpm = wpmHistory.length > 0 ? wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length : 0;
    const variance = wpmHistory.length > 0 ? wpmHistory.reduce((sum, w) => sum + Math.pow(w - avgWpm, 2), 0) / wpmHistory.length : 0;
    const stdDev = Math.sqrt(variance);
    const consistency = avgWpm > 0 ? Math.max(0, Math.round(100 - (stdDev / avgWpm) * 100)) : 100;

    return {
      wpm,
      rawWpm,
      accuracy,
      correctChars,
      incorrectChars,
      totalChars,
      elapsedTime,
      consistency,
    };
  }, [typedChars, words, currentWordIndex, currentCharIndex, elapsedTime, wpmHistory]);

  // Finish test
  const finishTest = useCallback(() => {
    setIsActive(false);
    setIsFinished(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const finalStats = calculateStats();
    setStats(finalStats);
  }, [calculateStats]);

  // Timer
  useEffect(() => {
    if (isActive && !isFinished && startTime) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsed);

        // Only add to WPM history every second and if we haven't already added for this second
        if (elapsed !== lastWpmUpdateRef.current) {
          lastWpmUpdateRef.current = elapsed;
          
          const totalTyped = typedChars.flat().length;
          const currentWpm = Math.round((totalTyped / 5) / (elapsed / 60)) || 0;
          setWpmHistory((prev) => [...prev, currentWpm]);
        }

        // Check time limit
        if (config.mode === "time" && config.timeLimit && elapsed >= config.timeLimit) {
          finishTest();
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isFinished, startTime, config.mode, config.timeLimit, typedChars, finishTest]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isFinished) return;

      if (settings.soundEnabled && (e.key.length === 1 || e.key === "Backspace" || e.key === " ")) {
        const normalizedVolume = (settings.soundVolume / 100);
        playTypingSound(normalizedVolume);
      }
      // Start test on first key
      if (!isActive && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
        setIsActive(true);
        setStartTime(Date.now());
      }

      const currentWord = words[currentWordIndex];
      if (!currentWord) return;

      if (e.key === " ") {
        e.preventDefault();
        
        // Move to next word
        if (currentCharIndex > 0) {
          // Check if this was the last word
          if (currentWordIndex === words.length - 1) {
            finishTest();
            return;
          }
          
          // Check word count limit
          if (config.mode === "words" && currentWordIndex + 1 >= (config.wordCount || 50)) {
            finishTest();
            return;
          }

          setCurrentWordIndex((prev) => prev + 1);
          setCurrentCharIndex(0);
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        
        if (currentCharIndex > 0) {
          setCurrentCharIndex((prev) => prev - 1);
          setTypedChars((prev) => {
            const newTyped = [...prev];
            if (newTyped[currentWordIndex]) {
              newTyped[currentWordIndex] = newTyped[currentWordIndex].slice(0, -1);
            }
            return newTyped;
          });
        } else if (currentWordIndex > 0) {
          // Go back to previous word
          setCurrentWordIndex((prev) => prev - 1);
          const prevWordTyped = typedChars[currentWordIndex - 1] || [];
          setCurrentCharIndex(prevWordTyped.length);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        
        // Don't allow typing beyond word length + some buffer
        if (currentCharIndex >= currentWord.length + 5) return;

        setTypedChars((prev) => {
          const newTyped = [...prev];
          if (!newTyped[currentWordIndex]) {
            newTyped[currentWordIndex] = [];
          }
          newTyped[currentWordIndex] = [...newTyped[currentWordIndex], e.key];
          return newTyped;
        });
        setCurrentCharIndex((prev) => prev + 1);
      }
    },
    [words, currentWordIndex, currentCharIndex, isActive, isFinished, typedChars, config.mode, config.wordCount, finishTest]
  );

  // Get character states for rendering
  const getCharStates = useCallback((): CharState[][] => {
    return words.map((word, wordIdx) => {
      const typed = typedChars[wordIdx] || [];
      const chars = word.split("").map((char, charIdx) => {
        if (wordIdx < currentWordIndex) {
          // Completed word
          if (charIdx < typed.length) {
            return {
              char,
              state: typed[charIdx] === char ? "correct" : "incorrect",
            } as CharState;
          }
          return { char, state: "incorrect" } as CharState; // Missing chars
        } else if (wordIdx === currentWordIndex) {
          // Current word
          if (charIdx < currentCharIndex) {
            return {
              char,
              state: typed[charIdx] === char ? "correct" : "incorrect",
            } as CharState;
          } else if (charIdx === currentCharIndex) {
            return { char, state: "current" } as CharState;
          }
          return { char, state: "upcoming" } as CharState;
        }
        return { char, state: "upcoming" } as CharState;
      });

      // Add extra typed characters
      if (typed.length > word.length) {
        for (let i = word.length; i < typed.length; i++) {
          chars.push({ char: typed[i], state: "incorrect" });
        }
      }

      return chars;
    });
  }, [words, typedChars, currentWordIndex, currentCharIndex]);

  // Focus input
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Get time display
  const getTimeDisplay = useCallback(() => {
    if (config.mode === "time" && config.timeLimit) {
      const remaining = Math.max(0, config.timeLimit - elapsedTime);
      return `${remaining}s`;
    }
    return `${elapsedTime}s`;
  }, [config.mode, config.timeLimit, elapsedTime]);

  // Get progress
  const getProgress = useCallback(() => {
    if (config.mode === "time" && config.timeLimit) {
      return (elapsedTime / config.timeLimit) * 100;
    }
    
    let totalCharsProcessed = 0;
    let totalCharsAvailable = 0;

    // Count up to current word
    for (let i = 0; i < currentWordIndex; i++) {
      totalCharsProcessed += (typedChars[i] || []).length;
      totalCharsAvailable += words[i]?.length || 0;
    }

    // Add current word progress
    totalCharsProcessed += currentCharIndex;
    totalCharsAvailable += words[currentWordIndex]?.length || 0;

    if (config.mode === "words" && config.wordCount) {
      // Progress based on words
      return ((currentWordIndex + Math.min(currentCharIndex / (words[currentWordIndex]?.length || 1), 1)) / config.wordCount) * 100;
    }

    // Progress based on total chars
    const totalCharsInAllWords = words.reduce((sum, word) => sum + word.length, 0);
    return totalCharsInAllWords > 0 ? (totalCharsProcessed / totalCharsInAllWords) * 100 : 0;
  }, [config.mode, config.timeLimit, config.wordCount, elapsedTime, currentWordIndex, currentCharIndex, typedChars, words]);

  return {
    words,
    charStates: getCharStates(),
    currentWordIndex,
    currentCharIndex,
    isActive,
    isFinished,
    elapsedTime,
    stats,
    wpmHistory,
    inputRef,
    handleKeyDown,
    resetTest,
    focusInput,
    getTimeDisplay,
    getProgress,
    calculateStats,
  };
}


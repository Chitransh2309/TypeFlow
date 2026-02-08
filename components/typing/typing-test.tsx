"use client";

import { useState, useEffect } from "react";
import {
  useTypingTest,
  type TestMode,
  type Difficulty,
} from "@/hooks/use-typing-test";
import { Button } from "@/components/ui/button";
import { TypingArea } from "./typing-area";
import { TestResults } from "./test-results";
import { TestConfig } from "./test-config";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { loadSettings, type UserSettings } from "@/lib/settings-store";

const TIME_OPTIONS = [15, 30, 60, 120];
const WORD_OPTIONS = [10, 25, 50, 100];

export function TypingTest() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [mode, setMode] = useState<TestMode>("time");
  const [timeLimit, setTimeLimit] = useState(30);
  const [wordCount, setWordCount] = useState(50);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // Load settings on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setMode(s.defaultMode);
    setTimeLimit(s.defaultTimeLimit);
    setWordCount(s.defaultWordCount);
    setDifficulty(s.defaultDifficulty);
  }, []);

  const config = {
    mode,
    timeLimit: mode === "time" ? timeLimit : undefined,
    wordCount: mode === "words" ? wordCount : undefined,
    difficulty,
  };

  const {
    words,
    charStates,
    currentWordIndex,
    isActive,
    isFinished,
    stats,
    wpmHistory,
    inputRef,
    handleKeyDown,
    resetTest,
    focusInput,
    getTimeDisplay,
    getProgress,
    calculateStats,
  } = useTypingTest(config);

  const handleModeChange = (newMode: TestMode) => {
    setMode(newMode);
    resetTest();
  };

  const handleTimeLimitChange = (newLimit: number) => {
    setTimeLimit(newLimit);
    resetTest();
  };

  const handleWordCountChange = (newCount: number) => {
    setWordCount(newCount);
    resetTest();
  };

  const handleDifficultyChange = (newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
    resetTest();
  };

  const fontSize = settings?.fontSize ?? "medium";
  const showLiveWpm = settings?.showLiveWpm ?? true;
  const showProgressBar = settings?.showProgressBar ?? true;

  if (isFinished && stats) {
    return (
      <TestResults
        stats={stats}
        wpmHistory={wpmHistory}
        mode={mode}
        modeValue={
          mode === "time"
            ? `${timeLimit}s`
            : mode === "words"
              ? `${wordCount} words`
              : "quote"
        }
        difficulty={difficulty}
        onRestart={resetTest}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Config bar - only show when not active */}
      {!isActive && (
        <TestConfig
          mode={mode}
          timeLimit={timeLimit}
          wordCount={wordCount}
          difficulty={difficulty}
          timeOptions={TIME_OPTIONS}
          wordOptions={WORD_OPTIONS}
          onModeChange={handleModeChange}
          onTimeLimitChange={handleTimeLimitChange}
          onWordCountChange={handleWordCountChange}
          onDifficultyChange={handleDifficultyChange}
        />
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {mode === "time" ? "time" : "words"}
          </span>
          <span className="text-2xl font-mono font-semibold text-primary">
            {mode === "time"
              ? getTimeDisplay()
              : `${currentWordIndex}/${wordCount}`}
          </span>
        </div>
        {isActive && showLiveWpm && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">wpm</span>
            <span className="text-2xl font-mono font-semibold">
              {calculateStats().wpm}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isActive && showProgressBar && (
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-linear"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
      )}

      {/* Typing area */}
      <TypingArea
        words={words}
        charStates={charStates}
        currentWordIndex={currentWordIndex}
        inputRef={inputRef}
        onKeyDown={handleKeyDown}
        onClick={focusInput}
        isActive={isActive}
        fontSize={fontSize}
      />

      {/* Restart button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetTest}
          className={cn(
            "gap-2 text-muted-foreground hover:text-foreground transition-opacity",
            isActive && "opacity-50"
          )}
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-xs">tab + enter to restart</span>
        </Button>
      </div>
    </div>
  );
}

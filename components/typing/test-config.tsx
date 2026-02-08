"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TestMode, Difficulty } from "@/hooks/use-typing-test";
import { Clock, Hash, Quote } from "lucide-react";

interface TestConfigProps {
  mode: TestMode;
  timeLimit: number;
  wordCount: number;
  difficulty: Difficulty;
  timeOptions: number[];
  wordOptions: number[];
  onModeChange: (mode: TestMode) => void;
  onTimeLimitChange: (limit: number) => void;
  onWordCountChange: (count: number) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
}

export function TestConfig({
  mode,
  timeLimit,
  wordCount,
  difficulty,
  timeOptions,
  wordOptions,
  onModeChange,
  onTimeLimitChange,
  onWordCountChange,
  onDifficultyChange,
}: TestConfigProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-card/50 rounded-xl border border-border/50">
      {/* Mode selection */}
      <div className="flex items-center gap-1 px-2 border-r border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-xs",
            mode === "time" && "bg-primary/10 text-primary"
          )}
          onClick={() => onModeChange("time")}
        >
          <Clock className="h-3.5 w-3.5" />
          time
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-xs",
            mode === "words" && "bg-primary/10 text-primary"
          )}
          onClick={() => onModeChange("words")}
        >
          <Hash className="h-3.5 w-3.5" />
          words
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-xs",
            mode === "quote" && "bg-primary/10 text-primary"
          )}
          onClick={() => onModeChange("quote")}
        >
          <Quote className="h-3.5 w-3.5" />
          quote
        </Button>
      </div>

      {/* Time/Word options */}
      {mode === "time" && (
        <div className="flex items-center gap-1 px-2 border-r border-border/50">
          {timeOptions.map((time) => (
            <Button
              key={time}
              variant="ghost"
              size="sm"
              className={cn(
                "text-xs min-w-[40px]",
                timeLimit === time && "bg-primary/10 text-primary"
              )}
              onClick={() => onTimeLimitChange(time)}
            >
              {time}
            </Button>
          ))}
        </div>
      )}

      {mode === "words" && (
        <div className="flex items-center gap-1 px-2 border-r border-border/50">
          {wordOptions.map((count) => (
            <Button
              key={count}
              variant="ghost"
              size="sm"
              className={cn(
                "text-xs min-w-[40px]",
                wordCount === count && "bg-primary/10 text-primary"
              )}
              onClick={() => onWordCountChange(count)}
            >
              {count}
            </Button>
          ))}
        </div>
      )}

      {/* Difficulty */}
      <div className="flex items-center gap-1 px-2">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <Button
            key={d}
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs capitalize",
              difficulty === d && "bg-primary/10 text-primary"
            )}
            onClick={() => onDifficultyChange(d)}
          >
            {d}
          </Button>
        ))}
      </div>
    </div>
  );
}

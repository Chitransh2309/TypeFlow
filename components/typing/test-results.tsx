"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RotateCcw,
  TrendingUp,
  Target,
  Zap,
  Clock,
  BarChart3,
  Share2,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { toast } from "sonner";

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

interface TestResultsProps {
  stats: TestStats;
  wpmHistory: number[];
  mode: string;
  modeValue: string;
  difficulty: string;
  onRestart: () => void;
}

export function TestResults({
  stats,
  wpmHistory,
  mode,
  modeValue,
  difficulty,
  onRestart,
}: TestResultsProps) {
  const { data: session } = useSession();
  const savedRef = useRef(false);

  // Save result on mount (only once)
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    const payload = {
      wpm: stats.wpm,
      rawWpm: stats.rawWpm,
      accuracy: stats.accuracy,
      consistency: stats.consistency,
      correctChars: stats.correctChars,
      incorrectChars: stats.incorrectChars,
      totalChars: stats.totalChars,
      elapsedTime: stats.elapsedTime,
      mode,
      modeValue,
      difficulty,
    };

    // Save to MongoDB if logged in
    if (session?.user?.id) {
      fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        // silently fail
      });
    }
  }, [stats, mode, modeValue, difficulty, session?.user?.id]);

  const chartData = wpmHistory.map((wpm, index) => ({
    time: index + 1,
    wpm,
  }));

  const primaryColor = "#e2b714";
  const mutedForeground = "#646669";

  const handleShare = () => {
    const text = `TypeFlow Results: ${stats.wpm} WPM | ${stats.accuracy}% Accuracy | ${stats.consistency}% Consistency`;
    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 fade-in">
      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              WPM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{stats.wpm}</p>
            <p className="text-xs text-muted-foreground mt-1">raw: {stats.rawWpm}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.accuracy}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.correctChars}/{stats.totalChars} chars
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.consistency}%</p>
            <p className="text-xs text-muted-foreground mt-1">stability score</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.elapsedTime}s</p>
            <p className="text-xs text-muted-foreground mt-1">
              {mode} - {modeValue}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* WPM Chart */}
      {wpmHistory.length >= 1 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              WPM Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length > 0 ? chartData : [{ time: 1, wpm: stats.wpm }]}>
                  <defs>
                    <linearGradient id="wpmResultGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke={mutedForeground} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={mutedForeground} fontSize={12} tickLine={false} axisLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(30, 30, 46, 0.9)",
                      border: "1px solid rgba(100, 102, 105, 0.3)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#d1d0c5" }}
                  />
                  <Area type="monotone" dataKey="wpm" stroke={primaryColor} fill="url(#wpmResultGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button onClick={onRestart} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" onClick={handleShare} className="gap-2 bg-transparent">
          <Share2 className="h-4 w-4" />
          Share Result
        </Button>
      </div>

      {/* Sign-in prompt for guests */}
      {!session?.user && (
        <p className="text-center text-xs text-muted-foreground">
          Sign in to save your results and appear on the leaderboard
        </p>
      )}
    </div>
  );
}

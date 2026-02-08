"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Target,
  BarChart3,
  Flame,
  Clock,
  Trophy,
  TrendingUp,
  Trash2,
  LogIn,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

interface TestRecord {
  _id?: string;
  id?: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  totalChars: number;
  elapsedTime: number;
  mode: string;
  modeValue: string;
  difficulty: string;
  createdAt?: string;
  timestamp?: number;
}

function getStats(history: TestRecord[]) {
  if (history.length === 0) {
    return { totalTests: 0, averageWpm: 0, bestWpm: 0, averageAccuracy: 0, currentStreak: 0, totalTime: 0, averageConsistency: 0 };
  }
  const totalTests = history.length;
  const averageWpm = Math.round(history.reduce((s, t) => s + t.wpm, 0) / totalTests);
  const bestWpm = Math.max(...history.map((t) => t.wpm));
  const averageAccuracy = Math.round(history.reduce((s, t) => s + t.accuracy, 0) / totalTests);
  const averageConsistency = Math.round(history.reduce((s, t) => s + t.consistency, 0) / totalTests);
  const totalTime = history.reduce((s, t) => s + t.elapsedTime, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const dayMs = 86400000;
  for (let d = 0; d < 365; d++) {
    const dayStart = today.getTime() - d * dayMs;
    const dayEnd = dayStart + dayMs;
    const hasTest = history.some((t) => {
      const ts = t.createdAt ? new Date(t.createdAt).getTime() : (t.timestamp ?? 0);
      return ts >= dayStart && ts < dayEnd;
    });
    if (hasTest) streak++;
    else if (d > 0) break;
  }

  return { totalTests, averageWpm, bestWpm, averageAccuracy, currentStreak: streak, totalTime, averageConsistency };
}

function getDailyStats(history: TestRecord[], days = 7) {
  const result: { date: string; wpm: number; accuracy: number; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86400000;
    const dayTests = history.filter((t) => {
      const ts = t.createdAt ? new Date(t.createdAt).getTime() : (t.timestamp ?? 0);
      return ts >= dayStart && ts < dayEnd;
    });
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    if (dayTests.length > 0) {
      result.push({
        date: label,
        wpm: Math.round(dayTests.reduce((s, t) => s + t.wpm, 0) / dayTests.length),
        accuracy: Math.round(dayTests.reduce((s, t) => s + t.accuracy, 0) / dayTests.length),
        count: dayTests.length,
      });
    } else {
      result.push({ date: label, wpm: 0, accuracy: 0, count: 0 });
    }
  }
  return result;
}

function getModeBreakdown(history: TestRecord[]) {
  const counts: Record<string, number> = {};
  for (const t of history) {
    const key = `${t.mode} ${t.modeValue}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const colors = ["#e2b714", "#ca4754", "#7e2a33", "#646669", "#4d9375", "#6c5ce7"];
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/tests");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // fall through
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === "loading") return;
    fetchHistory();
  }, [status, fetchHistory]);

  const stats = getStats(history);
  const dailyStats = getDailyStats(history, 7);
  const modeBreakdown = getModeBreakdown(history);
  const recentTests = history.slice(0, 6);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatTimeAgo = (record: TestRecord) => {
    const ts = record.createdAt ? new Date(record.createdAt).getTime() : (record.timestamp ?? 0);
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "TF";

  const primaryColor = "#e2b714";
  const mutedForeground = "#646669";

  const handleClearHistory = async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/tests", { method: "DELETE" });
      if (res.ok) {
        setHistory([]);
        toast.success("Test history cleared");
      }
    } catch {
      toast.error("Failed to clear history");
    }
  };

  // Not logged in state
  if (status !== "loading" && !session) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full bg-card/50 border-border/50">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Sign in to view your dashboard</h2>
              <p className="text-muted-foreground text-center text-sm">
                Track your typing progress, view statistics, and compete on the leaderboard.
              </p>
              <Button onClick={() => signIn("google")} className="gap-2 mt-2">
                <LogIn className="h-4 w-4" />
                Sign in with Google
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* User profile card */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="flex flex-col sm:flex-row items-center gap-6 py-6">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={session?.user?.image ?? undefined}
                  alt={session?.user?.name ?? "Guest"}
                />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-balance">
                  {session?.user?.name ?? "Guest Typist"}
                </h1>
                {session?.user?.email && (
                  <p className="text-muted-foreground text-sm">{session.user.email}</p>
                )}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4" />
                    {stats.totalTests} tests completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" />
                    {stats.currentStreak} day streak
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatTime(stats.totalTime)} practiced
                  </span>
                </div>
              </div>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stats overview */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardContent className="py-6">
                    <div className="h-4 w-16 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="bg-card/50 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Best WPM
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{stats.bestWpm}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Avg WPM
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.averageWpm}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.averageAccuracy}%</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Tests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.totalTests}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Streak
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {stats.currentStreak}
                    <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatTime(stats.totalTime)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Weekly Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyStats.some((d) => d.count > 0) ? (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyStats}>
                        <defs>
                          <linearGradient id="dashWpmGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke={mutedForeground} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke={mutedForeground} fontSize={12} tickLine={false} axisLine={false} domain={[0, "dataMax + 10"]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(30, 30, 46, 0.9)",
                            border: "1px solid rgba(100, 102, 105, 0.3)",
                            borderRadius: "8px",
                            color: "#d1d0c5",
                          }}
                          labelStyle={{ color: "#d1d0c5" }}
                        />
                        <Area type="monotone" dataKey="wpm" stroke={primaryColor} fill="url(#dashWpmGrad)" strokeWidth={2} name="Avg WPM" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Complete some tests to see your progress chart
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Mode Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {modeBreakdown.length > 0 ? (
                  <>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={modeBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                            {modeBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(30, 30, 46, 0.9)",
                              border: "1px solid rgba(100, 102, 105, 0.3)",
                              borderRadius: "8px",
                              color: "#d1d0c5",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {modeBreakdown.map((m) => (
                        <div key={m.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                          <span className="text-xs text-muted-foreground truncate">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No data yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Tests */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTests.length > 0 ? (
                <div className="space-y-2">
                  {recentTests.map((test, idx) => (
                    <div
                      key={test._id || test.id || idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{test.wpm} WPM</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Target className="h-3.5 w-3.5" />
                          <span>{test.accuracy}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {test.consistency}% consistency
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground capitalize">
                          {test.mode} - {test.modeValue}
                        </span>
                        <p className="text-xs text-muted-foreground/60">{formatTimeAgo(test)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Complete a typing test to see your results here
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

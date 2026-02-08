"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Award, Zap, Target } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage: string | null;
  wpm: number;
  accuracy: number;
  tests: number;
}

const timeframes = [
  { value: "all", label: "All Time" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Today" },
];

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?timeframe=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-muted-foreground">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/10 border-yellow-500/30";
      case 2:
        return "bg-gray-400/10 border-gray-400/30";
      case 3:
        return "bg-amber-600/10 border-amber-600/30";
      default:
        return "bg-card/50 border-border/50";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                Leaderboard
              </h1>
              <p className="text-muted-foreground mt-1">Top typists ranked by best WPM</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-card/50 rounded-lg border border-border/50">
              {timeframes.map((tf) => (
                <Button
                  key={tf.value}
                  variant="ghost"
                  size="sm"
                  className={cn("text-xs", timeframe === tf.value && "bg-primary/10 text-primary")}
                  onClick={() => setTimeframe(tf.value)}
                >
                  {tf.label}
                </Button>
              ))}
            </div>
          </div>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1">Rank</div>
                <div className="col-span-5">Player</div>
                <div className="col-span-2 text-right">WPM</div>
                <div className="col-span-2 text-right">Accuracy</div>
                <div className="col-span-2 text-right">Tests</div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.userId}
                      className={cn(
                        "grid grid-cols-12 gap-4 items-center p-3 rounded-lg border transition-colors",
                        getRankBg(entry.rank)
                      )}
                    >
                      <div className="col-span-1 flex items-center">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="col-span-5 flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.userImage ?? undefined} alt={entry.userName} />
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {entry.userName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">{entry.userName}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold">{entry.wpm}</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Target className="h-3.5 w-3.5" />
                          <span>{entry.accuracy}%</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground">
                        {entry.tests}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Trophy className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No results yet. Be the first to compete!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

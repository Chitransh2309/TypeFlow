"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Header } from "@/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Settings,
  Monitor,
  Volume2,
  Keyboard,
  Type,
  Eye,
  MousePointerClick,
  Check,
  RotateCcw,
  Cloud,
  CloudOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings-context";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type UserSettings,
} from "@/lib/settings-store";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [synced, setSynced] = useState(false);

  // Load settings: from server if logged in, else localStorage
  const loadAllSettings = useCallback(async () => {
    if (session?.user?.id) {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            const merged = { ...DEFAULT_SETTINGS, ...data };
            delete merged._id;
            delete merged.userId;
            delete merged.updatedAt;
            updateSettings(merged);
            setSynced(true);
          }
        }
      } catch {
        // use local settings
      }
    }
  }, [session?.user?.id, updateSettings]);

  useEffect(() => {
    setMounted(true);
    loadAllSettings();
  }, [loadAllSettings]);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    updateSettings({ [key]: value });
    // Sync to server if logged in
    if (session?.user?.id) {
      const next = { ...settings, [key]: value };
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }
  };

  const handleReset = async () => {
    updateSettings(DEFAULT_SETTINGS);
    setTheme("dark");
    if (session?.user?.id) {
      try {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT_SETTINGS),
        });
      } catch {
        // ignore
      }
    }
    toast.success("Settings reset to defaults");
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Settings className="h-8 w-8 text-primary" />
                Settings
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                Customize your typing experience
                {session?.user?.id && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    {synced ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
                    {synced ? "Synced" : "Local"}
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Appearance */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>{"Customize how TypeFlow looks"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "dark", label: "Dark", desc: "Easy on the eyes", preview: "bg-[#1a1a2e]" },
                    { value: "light", label: "Light", desc: "Classic bright", preview: "bg-[#f5f5f5]" },
                    { value: "system", label: "System", desc: "Follow OS", preview: "bg-gradient-to-r from-[#1a1a2e] to-[#f5f5f5]" },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        "p-4 rounded-lg border-2 transition-colors text-left",
                        theme === t.value ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <div className={cn("h-10 w-full rounded border border-border/20 mb-3", t.preview)} />
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Font Size
                </Label>
                <div className="flex items-center gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <Button
                      key={size}
                      variant="ghost"
                      size="sm"
                      className={cn("capitalize flex-1", settings.fontSize === size && "bg-primary/10 text-primary")}
                      onClick={() => update("fontSize", size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {"Preview: "}
                  <span className={cn("font-mono", settings.fontSize === "small" && "text-xl", settings.fontSize === "medium" && "text-2xl", settings.fontSize === "large" && "text-3xl")}>
                    the quick brown fox
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4" />
                  Caret Style
                </Label>
                <div className="flex items-center gap-2">
                  {(["line", "block", "underline"] as const).map((style) => (
                    <Button
                      key={style}
                      variant="ghost"
                      size="sm"
                      className={cn("capitalize flex-1", settings.caretStyle === style && "bg-primary/10 text-primary")}
                      onClick={() => update("caretStyle", style)}
                    >
                      {style}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {"Preview: "}
                  <span className={cn("font-mono text-lg", `caret-${settings.caretStyle}`)}>
                    a
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sound */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Sound
              </CardTitle>
              <CardDescription>Configure audio feedback</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sound-toggle">Typing Sounds</Label>
                  <p className="text-sm text-muted-foreground">Play sounds when typing</p>
                </div>
                <Switch id="sound-toggle" checked={settings.soundEnabled} onCheckedChange={(v) => update("soundEnabled", v)} />
              </div>
              {settings.soundEnabled && (
                <div className="space-y-3">
                  <Label>Volume</Label>
                  <div className="flex items-center gap-4">
                    <Slider value={[settings.soundVolume]} onValueChange={([v]) => update("soundVolume", v)} max={100} step={5} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-10 text-right">{settings.soundVolume}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Typing Display */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Typing Display
              </CardTitle>
              <CardDescription>Configure what you see while typing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="live-wpm">Show Live WPM</Label>
                  <p className="text-sm text-muted-foreground">Display WPM counter while typing</p>
                </div>
                <Switch id="live-wpm" checked={settings.showLiveWpm} onCheckedChange={(v) => update("showLiveWpm", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="progress-bar">Show Progress Bar</Label>
                  <p className="text-sm text-muted-foreground">Display progress indicator during test</p>
                </div>
                <Switch id="progress-bar" checked={settings.showProgressBar} onCheckedChange={(v) => update("showProgressBar", v)} />
              </div>
              {/* <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="smooth-caret">Smooth Caret</Label>
                  <p className="text-sm text-muted-foreground">Animate the caret movement</p>
                </div>
                <Switch id="smooth-caret" checked={settings.smoothCaret} onCheckedChange={(v) => update("smoothCaret", v)} />
              </div> */}
            </CardContent>
          </Card>

          {/* Keyboard */}
          {/* <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard
              </CardTitle>
              <CardDescription>Configure keyboard settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label>Keyboard Layout</Label>
                <Select value={settings.keyboardLayout} onValueChange={(v) => update("keyboardLayout", v as UserSettings["keyboardLayout"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwerty">QWERTY</SelectItem>
                    <SelectItem value="dvorak">Dvorak</SelectItem>
                    <SelectItem value="colemak">Colemak</SelectItem>
                    <SelectItem value="azerty">AZERTY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card> */}

          {/* Test Defaults */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="h-5 w-5" />
                Test Defaults
              </CardTitle>
              <CardDescription>Set default values for new tests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Default Mode</Label>
                <div className="flex items-center gap-2">
                  {(["time", "words", "quote"] as const).map((m) => (
                    <Button key={m} variant="ghost" size="sm" className={cn("capitalize flex-1", settings.defaultMode === m && "bg-primary/10 text-primary")} onClick={() => update("defaultMode", m)}>
                      {m}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Default Time Limit</Label>
                <div className="flex items-center gap-2">
                  {[15, 30, 60, 120].map((t) => (
                    <Button key={t} variant="ghost" size="sm" className={cn("flex-1", settings.defaultTimeLimit === t && "bg-primary/10 text-primary")} onClick={() => update("defaultTimeLimit", t)}>
                      {t}s
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Default Word Count</Label>
                <div className="flex items-center gap-2">
                  {[10, 25, 50, 100].map((c) => (
                    <Button key={c} variant="ghost" size="sm" className={cn("flex-1", settings.defaultWordCount === c && "bg-primary/10 text-primary")} onClick={() => update("defaultWordCount", c)}>
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Default Difficulty</Label>
                <div className="flex items-center gap-2">
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <Button key={d} variant="ghost" size="sm" className={cn("capitalize flex-1", settings.defaultDifficulty === d && "bg-primary/10 text-primary")} onClick={() => update("defaultDifficulty", d)}>
                      {d}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

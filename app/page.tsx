import { Header } from "@/components/header";
import { TypingTest } from "@/components/typing";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
          <TypingTest />
        </div>
      </main>
      <footer className="border-t border-border/40 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>TypeFlow - Improve your typing speed and accuracy</p>
        </div>
      </footer>
    </div>
  );
}

import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/ga4-client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Search = { next?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — PureWhite BG" },
      { name: "description", content: "Sign in or create your PureWhite BG account to unlock unlimited batch background removal." },
      { property: "og:title", content: "Sign in — PureWhite BG" },
      { property: "og:description", content: "Sign in or create your PureWhite BG account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function isSafeInternalPath(p: string | undefined): p is string {
  return !!p && p.startsWith("/") && !p.startsWith("//");
}

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const dest = isSafeInternalPath(next) ? next : "/";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        // This branch is reached when the page mounts with a session
        // already present — in practice that's the Google OAuth redirect
        // returning here. created_at vs last_sign_in_at within a few
        // seconds of each other means the account was just created;
        // otherwise it's a returning user. Email/password auth fires its
        // own explicit sign_up/login events below instead of through here.
        const created = Date.parse(data.user.created_at);
        const lastSignIn = data.user.last_sign_in_at
          ? Date.parse(data.user.last_sign_in_at)
          : created;
        const isNew = Math.abs(lastSignIn - created) < 10_000;
        track(isNew ? "sign_up" : "login", { method: "google" });
        window.location.href = dest;
      }
    });
    return () => {
      mounted = false;
    };
  }, [dest]);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      window.location.href = dest;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}`,
          },
        });
        if (error) throw error;
        track("sign_up", { method: "email" });
        toast.success("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("login", { method: "email" });
        window.location.href = dest;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold text-center">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {mode === "signin"
            ? "Welcome back to PureWhite BG"
            : "Start with 3 free processing credits"}
        </p>

        <Button
          onClick={handleGoogle}
          disabled={busy}
          variant="outline"
          className="mt-6 w-full"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Google"}
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-primary font-semibold hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </Card>
    </div>
  );
}
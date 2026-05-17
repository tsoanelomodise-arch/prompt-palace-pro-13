import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed");
    if (result.redirected) return;
    if (!result.error) window.location.href = "/";
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Editorial left panel */}
      <div className="hidden lg:flex flex-col justify-between bg-ink p-12 text-paper" style={{ backgroundColor: "var(--ink-deep)" }}>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/70">
          <span className="h-2 w-2 rounded-full bg-paper" />
          The Prompt Library
        </div>
        <div>
          <h1 className="font-display text-5xl xl:text-6xl font-semibold leading-[1.05] text-paper">
            A shared shelf for every prompt the team writes.
          </h1>
          <p className="mt-6 max-w-md text-paper/70">
            Curated, versioned, and instantly fillable. Stop re-writing the same instructions.
          </p>
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-paper/50">
          Internal — Agency Team Only
        </div>
      </div>

      {/* Form right panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {mode === "signin" ? "Sign in" : "Create account"}
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            {mode === "signin" ? "Welcome back." : "Join the library."}
          </h2>

          <Button onClick={onGoogle} variant="outline" className="mt-8 w-full h-11">
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or with email
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

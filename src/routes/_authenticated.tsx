import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BookMarked, Plus, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/70 bg-paper/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <BookMarked className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-semibold tracking-tight">Prompt Library</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Internal</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/new">
              <Button size="sm" className="h-9 gap-1.5">
                <Plus className="h-4 w-4" /> New prompt
              </Button>
            </Link>
            <div className="hidden sm:block ml-3 text-sm text-muted-foreground border-l border-border pl-3">
              {user?.email}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 py-6 mt-12">
        <div className="mx-auto max-w-6xl px-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          The Prompt Library · Internal Tool
        </div>
      </footer>
    </div>
  );
}

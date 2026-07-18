import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BookMarked, LogOut, Users, Library, Shield, BookOpen, KanbanSquare, Repeat, KeyRound, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/70 bg-paper/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <BookMarked className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-semibold tracking-tight">Agency CRM</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Internal
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            <PipelineGroup />
            <NavLink to="/clients" icon={<Users className="h-3.5 w-3.5" />}>Clients</NavLink>
            <NavLink to="/logins" icon={<KeyRound className="h-3.5 w-3.5" />}>Logins</NavLink>
            <NavLink to="/" icon={<Library className="h-3.5 w-3.5" />}>Prompts</NavLink>
            <NavLink to="/wiki" icon={<BookOpen className="h-3.5 w-3.5" />}>Wiki</NavLink>
            {isAdmin && (
              <NavLink to="/team" icon={<Shield className="h-3.5 w-3.5" />}>Team</NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden sm:flex items-center gap-2 mr-2 text-sm text-muted-foreground">
              <span>{user?.email}</span>
              {isAdmin && (
                <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  admin
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-6 pb-3 -mt-1 overflow-x-auto">
          <PipelineGroup />
          <NavLink to="/clients" icon={<Users className="h-3.5 w-3.5" />}>Clients</NavLink>
          <NavLink to="/logins" icon={<KeyRound className="h-3.5 w-3.5" />}>Logins</NavLink>
          <NavLink to="/" icon={<Library className="h-3.5 w-3.5" />}>Prompts</NavLink>
          <NavLink to="/wiki" icon={<BookOpen className="h-3.5 w-3.5" />}>Wiki</NavLink>
          {isAdmin && <NavLink to="/team" icon={<Shield className="h-3.5 w-3.5" />}>Team</NavLink>}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 py-6 mt-12">
        <div className="mx-auto max-w-6xl px-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Agency CRM · Internal Tool
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-paper-soft transition"
      activeProps={{ className: "text-foreground bg-paper-soft" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {children}
    </Link>
  );
}

function PipelineGroup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/pipeline", icon: <KanbanSquare className="h-3.5 w-3.5" />, label: "Pipeline" },
    { to: "/recurring", icon: <Repeat className="h-3.5 w-3.5" />, label: "Recurring" },
  ];
  const isActive = items.some((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md transition",
            isActive
              ? "text-foreground bg-paper-soft"
              : "text-muted-foreground hover:text-foreground hover:bg-paper-soft",
            "data-[state=open]:text-foreground data-[state=open]:bg-paper-soft"
          )}
        >
          <KanbanSquare className="h-3.5 w-3.5" />
          Pipeline
          <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link
              to={item.to}
              className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] uppercase tracking-widest"
              activeProps={{ className: "text-foreground bg-paper-soft" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.icon}
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

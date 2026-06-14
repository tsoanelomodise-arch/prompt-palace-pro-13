import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: TeamPage,
});

type Member = { user_id: string; roles: string[] };

function TeamPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role").order("user_id");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((r) => {
        map[r.user_id] ??= [];
        map[r.user_id].push(r.role);
      });
      return Object.entries(map).map(([user_id, roles]) => ({ user_id, roles })) as Member[];
    },
  });

  const setAdmin = async (uid: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      if (uid === user?.id) return toast.error("You can't remove your own admin role.");
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["team"] });
    toast.success(makeAdmin ? "Promoted to admin" : "Admin role removed");
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="pb-8 border-b border-border">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Team</p>
        <h1 className="mt-2 font-display text-5xl font-semibold">Roles & access.</h1>
        <p className="mt-3 text-muted-foreground max-w-xl">
          Admins can add and reveal client logins, manage team roles, and edit anything in the CRM. Members can read everything except passwords.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft/50 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isAdmin = m.roles.includes("admin");
                const isMe = m.user_id === user?.id;
                return (
                  <tr key={m.user_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-xs">{m.user_id.slice(0, 8)}…</span>
                        {isMe && <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">(you)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${isAdmin ? "bg-primary text-primary-foreground" : "bg-paper-soft border border-border text-muted-foreground"}`}>
                        {isAdmin && <Shield className="h-3 w-3" />}
                        {isAdmin ? "admin" : "member"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <Button size="sm" variant="outline" disabled={isMe} onClick={() => setAdmin(m.user_id, false)}>
                          Remove admin
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setAdmin(m.user_id, true)}>Make admin</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Users appear here after they sign in for the first time.
      </p>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, User as UserIcon, Mail, UserPlus, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { inviteTeamMember, listTeamMembers, removeTeamMember } from "@/lib/team.functions";
import { formatDistanceToNow } from "date-fns";

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

function TeamPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fetchMembers = useServerFn(listTeamMembers);
  const invite = useServerFn(inviteTeamMember);
  const remove = useServerFn(removeTeamMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchMembers(),
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

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await invite({ data: { email: email.trim(), role } });
      toast.success(res.alreadyExisted ? "User existed — role granted" : `Invite sent to ${res.email}`);
      setEmail("");
      setRole("member");
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const onRemove = async (uid: string) => {
    try {
      await remove({ data: { userId: uid } });
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
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

      {/* Invite */}
      <form onSubmit={onInvite} className="mt-8 bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4" />
          <h2 className="font-display font-semibold">Invite a teammate</h2>
        </div>
        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={inviting} className="gap-1.5 h-10">
            {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            {inviting ? "Sending…" : "Send invite"}
          </Button>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          They'll receive a sign-in email and join your workspace immediately.
        </p>
      </form>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft/50 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isAdmin = m.roles.includes("admin");
                const isMe = m.user_id === user?.id;
                const pending = !m.confirmed && !m.lastSignInAt;
                return (
                  <tr key={m.user_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{m.email}</span>
                        {isMe && <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">(you)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {pending
                        ? "Invited"
                        : m.lastSignInAt
                          ? `Active ${formatDistanceToNow(new Date(m.lastSignInAt), { addSuffix: true })}`
                          : "Joined"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${isAdmin ? "bg-primary text-primary-foreground" : "bg-paper-soft border border-border text-muted-foreground"}`}>
                        {isAdmin && <Shield className="h-3 w-3" />}
                        {isAdmin ? "admin" : "member"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {isAdmin ? (
                          <Button size="sm" variant="outline" disabled={isMe} onClick={() => setAdmin(m.user_id, false)}>
                            Remove admin
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setAdmin(m.user_id, true)}>Make admin</Button>
                        )}
                        {!isMe && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {m.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This deletes their account and revokes all access. Their authored content stays.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onRemove(m.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  KeyRound, Search, Plus, ExternalLink, Eye, EyeOff, Copy, Trash2, Pencil, X, Save, Building2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ClientLite = {
  id: string;
  name: string;
};

type CredRow = {
  id: string;
  client_id: string;
  client: ClientLite | null;
  label: string;
  system: string | null;
  url: string | null;
  username: string | null;
  notes: string | null;
  last_rotated_at: string | null;
};

export const Route = createFileRoute("/_authenticated/logins")({
  component: LoginsPage,
});

function LoginsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [clientIdFilter, setClientIdFilter] = useState<string | "all">("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    label: "",
    system: "",
    url: "",
    username: "",
    password: "",
    notes: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data as ClientLite[];
    },
  });

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ["credentials", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credentials")
        .select("id,client_id,label,system,url,username,notes,last_rotated_at,clients(id,name)")
        .order("label");
      if (error) throw error;
      return (data ?? []).map((r) => {
        const client = (r.clients as any) ?? null;
        return {
          id: r.id,
          client_id: r.client_id,
          client: client ? { id: client.id, name: client.name } : null,
          label: r.label,
          system: r.system,
          url: r.url,
          username: r.username,
          notes: r.notes,
          last_rotated_at: r.last_rotated_at,
        } as CredRow;
      });
    },
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return creds.filter((c) => {
      if (clientIdFilter !== "all" && c.client_id !== clientIdFilter) return false;
      if (!ql) return true;
      return (
        c.label.toLowerCase().includes(ql) ||
        c.system?.toLowerCase().includes(ql) ||
        c.url?.toLowerCase().includes(ql) ||
        c.username?.toLowerCase().includes(ql) ||
        c.client?.name.toLowerCase().includes(ql) ||
        c.notes?.toLowerCase().includes(ql)
      );
    });
  }, [creds, q, clientIdFilter]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.client_id) return;
    const { data, error } = await supabase
      .from("credentials")
      .insert({
        client_id: form.client_id,
        label: form.label.trim(),
        system: form.system.trim() || null,
        url: form.url.trim() || null,
        username: form.username.trim() || null,
        notes: form.notes.trim() || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (form.password) {
      const { error: e2 } = await supabase.rpc("credential_set_secret", { _id: data.id, _plain: form.password });
      if (e2) toast.error(`Saved metadata but could not encrypt password: ${e2.message}`);
    }
    setForm({ client_id: "", label: "", system: "", url: "", username: "", password: "", notes: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["credentials", "all"] });
    qc.invalidateQueries({ queryKey: ["credentials"] });
    toast.success("Login saved");
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 mb-10 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {creds.length} login{creds.length === 1 ? "" : "s"} across the roster
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Logins.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Every system login and credential in one place. Passwords are encrypted at rest and only admins can reveal them.
          </p>
        </div>
        {isAdmin && (
          <Button className="h-11 gap-1.5" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> New login
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-end mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logins, systems, clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Label className="text-xs text-muted-foreground">Client</Label>
          <select
            value={clientIdFilter}
            onChange={(e) => setClientIdFilter(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {adding && isAdmin && (
        <form onSubmit={add} className="bg-paper-soft/50 border border-border rounded-lg p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-xs">Client *</Label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div><Label className="text-xs">Label *</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-10 mt-1" placeholder="Production WordPress" autoFocus required /></div>
          <div><Label className="text-xs">System</Label><Input value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })} className="h-10 mt-1" placeholder="WordPress" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="h-10 mt-1" placeholder="https://acme.com/wp-admin" /></div>
          <div><Label className="text-xs">Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-10 mt-1" autoComplete="off" /></div>
          <div><Label className="text-xs">Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-10 mt-1 font-mono" autoComplete="new-password" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-[80px]" placeholder="2FA codes, recovery email, etc." /></div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="sm">Save login</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <h3 className="mt-4 font-display text-xl font-semibold">
            {creds.length === 0 ? "No logins yet" : "No matches"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {creds.length === 0
              ? "Add a system login from a client page or here."
              : "Try a different search or client filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CredentialRow key={c.id} cred={c} clients={clients} />
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialRow({ cred, clients }: { cred: CredRow; clients: ClientLite[] }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
    client_id: cred.client_id,
    label: cred.label,
    system: cred.system ?? "",
    url: cred.url ?? "",
    username: cred.username ?? "",
    password: "",
    notes: cred.notes ?? "",
  });

  const reveal = async () => {
    if (revealed) { setRevealed(null); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("credential_reveal", { _id: cred.id });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("No password stored");
    setRevealed(data as string);
  };

  const copy = async () => {
    if (!revealed) {
      setLoading(true);
      const { data, error } = await supabase.rpc("credential_reveal", { _id: cred.id });
      setLoading(false);
      if (error) return toast.error(error.message);
      if (!data) return toast.error("No password stored");
      await navigator.clipboard.writeText(data as string);
    } else {
      await navigator.clipboard.writeText(revealed);
    }
    toast.success("Password copied");
  };

  const del = async () => {
    const { error } = await supabase.from("credentials").delete().eq("id", cred.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["credentials", "all"] });
    qc.invalidateQueries({ queryKey: ["credentials"] });
    toast.success("Login removed");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.label.trim() || !edit.client_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("credentials")
      .update({
        client_id: edit.client_id,
        label: edit.label.trim(),
        system: edit.system.trim() || null,
        url: edit.url.trim() || null,
        username: edit.username.trim() || null,
        notes: edit.notes.trim() || null,
      })
      .eq("id", cred.id);
    if (error) { setSaving(false); return toast.error(error.message); }
    if (edit.password) {
      const { error: e2 } = await supabase.rpc("credential_set_secret", { _id: cred.id, _plain: edit.password });
      if (e2) { setSaving(false); return toast.error(`Saved metadata but could not update password: ${e2.message}`); }
      setRevealed(null);
    }
    setSaving(false);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["credentials", "all"] });
    qc.invalidateQueries({ queryKey: ["credentials"] });
    toast.success("Login updated");
  };

  if (editing && isAdmin) {
    return (
      <form onSubmit={save} className="border border-border rounded-lg bg-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs">Client *</Label>
          <select
            value={edit.client_id}
            onChange={(e) => setEdit({ ...edit, client_id: e.target.value })}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div><Label className="text-xs">Label *</Label><Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className="h-10 mt-1" autoFocus required /></div>
        <div><Label className="text-xs">System</Label><Input value={edit.system} onChange={(e) => setEdit({ ...edit, system: e.target.value })} className="h-10 mt-1" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">URL</Label><Input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} className="h-10 mt-1" /></div>
        <div><Label className="text-xs">Username</Label><Input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} className="h-10 mt-1" autoComplete="off" /></div>
        <div><Label className="text-xs">Password <span className="text-muted-foreground font-normal">(leave blank to keep)</span></Label><Input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} className="h-10 mt-1 font-mono" autoComplete="new-password" placeholder="••••••••••" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="mt-1 min-h-[80px]" /></div>
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-display font-semibold">{cred.label}</h4>
            {cred.system && <Badge variant="secondary" className="font-mono text-[10px] font-normal">{cred.system}</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {cred.client ? (
              <Link
                to="/clients/$clientId"
                params={{ clientId: cred.client.id }}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest hover:text-foreground"
              >
                <Building2 className="h-3 w-3" /> {cred.client.name}
              </Link>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest">Unknown client</span>
            )}
            {cred.url && (
              <>
                <span className="text-border">·</span>
                <a href={cred.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground break-all">
                  {cred.url} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this login?</AlertDialogTitle>
                  <AlertDialogDescription>The encrypted password will be lost.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Username</div>
          <div className="font-mono mt-1 break-all">{cred.username ?? "—"}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="font-mono px-2 py-1 rounded bg-paper-soft border border-border flex-1 truncate">
              {revealed ?? "••••••••••"}
            </code>
            {isAdmin && (
              <>
                <Button size="icon" variant="ghost" onClick={reveal} disabled={loading} title={revealed ? "Hide" : "Reveal"}>
                  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={copy} disabled={loading} title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {cred.notes && (
        <p className="mt-4 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border pt-3">{cred.notes}</p>
      )}
      {cred.last_rotated_at && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Rotated {formatDistanceToNow(new Date(cred.last_rotated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

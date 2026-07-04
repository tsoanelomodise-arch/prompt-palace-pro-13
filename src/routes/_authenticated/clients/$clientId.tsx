import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageTextarea } from "@/components/ui/image-textarea";
import { Markdown } from "@/components/ui/markdown";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, ExternalLink, Plus, KeyRound, Eye, EyeOff, Copy, Trash2,
  Briefcase, User as UserIcon, FileText, StickyNote, Mail, Phone, Pencil, Save, X,
  MessageSquare, PhoneCall, Users, MessageCircle, CalendarClock, Repeat,
} from "lucide-react";
import { REPEAT_INTERVALS, repeatLabel, type RepeatInterval } from "@/lib/pipeline";
import { formatDistanceToNow, format } from "date-fns";
import { LinkedWikiPages } from "@/components/wiki/LinkedWikiPages";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientDetail,
});

type Tab = "overview" | "projects" | "contacts" | "credentials" | "prompts" | "conversations" | "notes";

function ClientDetail() {
  const { clientId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.replace("#", "") as Tab;
    if (["overview", "projects", "contacts", "credentials", "prompts", "conversations", "notes"].includes(h)) {
      setTab(h);
    }
  }, []);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (next: string) => {
    if (!client || client.status === next) return;
    qc.setQueryData(["client", clientId], { ...client, status: next });
    const { error } = await supabase.from("clients").update({ status: next }).eq("id", clientId);
    if (error) {
      toast.error("Could not update status");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    } else {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
  };

  if (isLoading || !client) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <button
        onClick={() => router.navigate({ to: "/clients" })}
        className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </button>

      {/* Header */}
      <div className="pb-8 border-b border-border">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {client.industry ?? "Client"}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            {client.name}
          </h1>
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <select
              value={client.status}
              onChange={(e) => updateStatus(e.target.value)}
              className="font-mono text-[11px] uppercase tracking-widest px-2 py-1 rounded-full border border-border bg-background hover:border-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              title="Change status"
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
              {!["active", "paused", "archived"].includes(client.status) && (
                <option value={client.status}>{client.status}</option>
              )}
            </select>
            {client.website && (
              <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                {client.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mt-6 flex gap-1 overflow-x-auto">
        {(
          [
            ["overview", "Overview", null],
            ["projects", "Projects", <Briefcase key="p" className="h-3.5 w-3.5" />],
            ["contacts", "Contacts", <UserIcon key="c" className="h-3.5 w-3.5" />],
            ["credentials", "Logins", <KeyRound key="k" className="h-3.5 w-3.5" />],
            ["prompts", "Prompts", <FileText key="f" className="h-3.5 w-3.5" />],
            ["conversations", "Conversations", <MessageSquare key="v" className="h-3.5 w-3.5" />],
            ["notes", "Notes", <StickyNote key="n" className="h-3.5 w-3.5" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k as Tab)}
            className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-4 py-3 border-b-2 -mb-px transition ${
              tab === k
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "overview" && <OverviewPane client={client} />}
        {tab === "projects" && <ProjectsPane clientId={clientId} />}
        {tab === "contacts" && <ContactsPane clientId={clientId} />}
        {tab === "credentials" && <CredentialsPane clientId={clientId} />}
        {tab === "prompts" && <PromptsPane clientId={clientId} />}
        {tab === "conversations" && <ConversationsPane clientId={clientId} />}
        {tab === "notes" && <NotesPane clientId={clientId} />}
      </div>
    </div>
  );
}

// =====================================================
// Overview
// =====================================================
function OverviewPane({ client }: { client: { id: string; notes: string | null; created_at: string; updated_at: string } }) {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(client.notes ?? "");

  const save = async () => {
    const { error } = await supabase.from("clients").update({ notes: notes.trim() || null }).eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
  };

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-8">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Notes</p>
          {(isAdmin || !!user) && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5 h-8">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            <ImageTextarea value={notes} onValueChange={setNotes} className="min-h-[200px]" />
            <div className="flex gap-2">
              <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1.5" /> Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setNotes(client.notes ?? ""); setEditing(false); }}>
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
            </div>
          </div>
        ) : client.notes ? (
          <div className="bg-card border border-border rounded-lg p-5">
            <Markdown>{client.notes}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes yet.</p>
        )}
        <div className="mt-8">
          <LinkedWikiPages entityType="client" entityId={client.id} />
        </div>
      </div>
      <aside className="space-y-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <div>
          <div>Created</div>
          <div className="mt-1 text-foreground normal-case font-sans">
            {format(new Date(client.created_at), "PP")}
          </div>
        </div>
        <div>
          <div>Updated</div>
          <div className="mt-1 text-foreground normal-case font-sans">
            {formatDistanceToNow(new Date(client.updated_at), { addSuffix: true })}
          </div>
        </div>
      </aside>
    </div>
  );
}

// =====================================================
// Projects
// =====================================================
function ProjectsPane({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("projects").insert({
      client_id: clientId, name: name.trim(), status, created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setName(""); setStatus("active"); setAdding(false);
    qc.invalidateQueries({ queryKey: ["projects", clientId] });
    toast.success("Project added");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add project
        </Button>
      </div>
      {adding && (
        <form onSubmit={add} className="bg-paper-soft/50 border border-border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Project name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 mt-1" placeholder="Website redesign" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 mt-1 rounded-md border border-input bg-background px-3 text-sm">
              <option value="lead">Lead</option>
              <option value="proposal">Proposal</option>
              <option value="active">Active</option>
              <option value="review">Review</option>
              <option value="delivered">Delivered</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <Button type="submit" size="sm">Save</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      )}
      {projects.length === 0 ? (
        <EmptyTab icon={<Briefcase className="h-8 w-8" />} title="No projects yet" hint="Add your first engagement with this client." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-4 bg-card hover:border-foreground/60 transition space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-display font-semibold">{p.name}</h4>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.status}</span>
                </div>
                {p.notes && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.notes}</p>}
              </div>
              <LinkedWikiPages entityType="project" entityId={p.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Contacts
// =====================================================
function ContactsPane({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "" });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("client_id", clientId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    const { error } = await supabase.from("contacts").insert({
      client_id: clientId,
      created_by: user.id,
      name: form.name.trim(),
      role: form.role.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    });
    if (error) return toast.error(error.message);
    setForm({ name: "", role: "", email: "", phone: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["contacts", clientId] });
    toast.success("Contact added");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add contact
        </Button>
      </div>
      {adding && (
        <form onSubmit={add} className="bg-paper-soft/50 border border-border rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 mt-1" autoFocus /></div>
          <div><Label className="text-xs">Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 mt-1" placeholder="CMO" /></div>
          <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 mt-1" /></div>
          <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 mt-1" /></div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="sm">Save contact</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {contacts.length === 0 ? (
        <EmptyTab icon={<UserIcon className="h-8 w-8" />} title="No contacts yet" hint="Add the people at this company." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.map((c) => (
            <div key={c.id} className="border border-border rounded-lg p-4 bg-card">
              <h4 className="font-display font-semibold">{c.name}</h4>
              {c.role && <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{c.role}</p>}
              <div className="mt-3 space-y-1 text-sm">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" /> {c.email}
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Credentials
// =====================================================
function CredentialsPane({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", system: "", url: "", username: "", password: "", notes: "" });

  const { data: creds = [] } = useQuery({
    queryKey: ["credentials", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credentials")
        .select("id,label,system,url,username,notes,last_rotated_at,created_at")
        .eq("client_id", clientId)
        .order("label");
      if (error) throw error;
      return data;
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    const { data, error } = await supabase
      .from("credentials")
      .insert({
        client_id: clientId,
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
    setForm({ label: "", system: "", url: "", username: "", password: "", notes: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["credentials", clientId] });
    toast.success("Login saved");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {creds.length} login{creds.length === 1 ? "" : "s"}
          </p>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-1">
              You can view login details. Only admins can add new ones or reveal passwords.
            </p>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add login
          </Button>
        )}
      </div>

      {adding && isAdmin && (
        <form onSubmit={add} className="bg-paper-soft/50 border border-border rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Label *</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-10 mt-1" placeholder="Production WordPress" autoFocus /></div>
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

      {creds.length === 0 ? (
        <EmptyTab
          icon={<KeyRound className="h-8 w-8" />}
          title="No logins stored"
          hint={isAdmin ? "Add a client system login. Passwords are encrypted at rest." : "An admin hasn't added any logins for this client yet."}
        />
      ) : (
        <div className="space-y-3">
          {creds.map((c) => (
            <CredentialRow key={c.id} cred={c} clientId={clientId} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialRow({ cred, clientId, isAdmin }: { cred: { id: string; label: string; system: string | null; url: string | null; username: string | null; notes: string | null; last_rotated_at: string | null }; clientId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
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
    qc.invalidateQueries({ queryKey: ["credentials", clientId] });
    toast.success("Login removed");
  };

  const startEdit = () => {
    setEdit({
      label: cred.label,
      system: cred.system ?? "",
      url: cred.url ?? "",
      username: cred.username ?? "",
      password: "",
      notes: cred.notes ?? "",
    });
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.label.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("credentials")
      .update({
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
    qc.invalidateQueries({ queryKey: ["credentials", clientId] });
    toast.success("Login updated");
  };

  if (editing && isAdmin) {
    return (
      <form onSubmit={save} className="border border-border rounded-lg bg-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-xs">Label *</Label><Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className="h-10 mt-1" autoFocus /></div>
        <div><Label className="text-xs">System</Label><Input value={edit.system} onChange={(e) => setEdit({ ...edit, system: e.target.value })} className="h-10 mt-1" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">URL</Label><Input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} className="h-10 mt-1" /></div>
        <div><Label className="text-xs">Username</Label><Input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} className="h-10 mt-1" autoComplete="off" /></div>
        <div><Label className="text-xs">Password <span className="text-muted-foreground font-normal">(leave blank to keep)</span></Label><Input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} className="h-10 mt-1 font-mono" autoComplete="new-password" placeholder="••••••••••" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="mt-1 min-h-[80px]" /></div>
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-display font-semibold">{cred.label}</h4>
            {cred.system && <Badge variant="secondary" className="font-mono text-[10px] font-normal">{cred.system}</Badge>}
          </div>
          {cred.url && (
            <a href={cred.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground break-all">
              {cred.url} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={startEdit} title="Edit">
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

      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
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
        <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border pt-3">{cred.notes}</p>
      )}
      {cred.last_rotated_at && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Rotated {formatDistanceToNow(new Date(cred.last_rotated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

// =====================================================
// Prompts attached
// =====================================================
function PromptsPane({ clientId }: { clientId: string }) {
  const { data: prompts = [] } = useQuery({
    queryKey: ["client-prompts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("id,title,description,category,updated_at")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {prompts.length} prompt{prompts.length === 1 ? "" : "s"} for this client
        </p>
        <Link to="/new" search={{ clientId } as never}>
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New prompt</Button>
        </Link>
      </div>
      {prompts.length === 0 ? (
        <EmptyTab icon={<FileText className="h-8 w-8" />} title="No prompts linked" hint="Tag prompts to this client when you write them." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {prompts.map((p) => (
            <Link key={p.id} to="/$id" params={{ id: p.id }} className="border border-border rounded-lg p-4 bg-card hover:border-foreground/60 transition">
              {p.category && <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.category}</p>}
              <h4 className="font-display font-semibold mt-1">{p.title}</h4>
              {p.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Notes (timeline)
// =====================================================
function NotesPane({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notes")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    const { error } = await supabase.from("client_notes").insert({
      client_id: clientId, body: body.trim(), created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setBody("");
    qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
  };

  return (
    <div className="max-w-3xl">
      <form onSubmit={add} className="mb-6">
        <ImageTextarea
          value={body}
          onValueChange={setBody}
          placeholder="Log a call, meeting, or quick update…"
          className="min-h-[100px]"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={!body.trim()}>Add note</Button>
        </div>
      </form>
      {notes.length === 0 ? (
        <EmptyTab icon={<StickyNote className="h-8 w-8" />} title="No notes yet" hint="Activity log starts the moment you add one." />
      ) : (
        <ol className="relative border-l border-border pl-6 space-y-6">
          {notes.map((n) => (
            <li key={n.id} className="relative">
              <span className="absolute -left-[29px] top-2 h-2.5 w-2.5 rounded-full bg-foreground" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {format(new Date(n.created_at), "PPp")}
              </p>
              <Markdown className="mt-2">{n.body}</Markdown>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyTab({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
      <div className="mx-auto w-fit">{icon}</div>
      <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm">{hint}</p>
    </div>
  );
}

// =====================================================
// Conversations
// =====================================================
type ConvChannel = "email" | "call" | "meeting" | "whatsapp" | "sms" | "other";
const CHANNELS: { value: ConvChannel; label: string; icon: React.ReactNode }[] = [
  { value: "meeting", label: "Meeting", icon: <Users className="h-3.5 w-3.5" /> },
  { value: "call", label: "Call", icon: <PhoneCall className="h-3.5 w-3.5" /> },
  { value: "email", label: "Email", icon: <Mail className="h-3.5 w-3.5" /> },
  { value: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { value: "sms", label: "SMS", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { value: "other", label: "Other", icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ConversationsPane({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyForm = () => ({
    channel: "meeting" as ConvChannel,
    subject: "",
    summary: "",
    participants: "",
    occurred_at: toLocalInputValue(new Date()),
    follow_up_at: "",
    contact_id: "",
    project_id: "",
  });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const { data: convos = [] } = useQuery({
    queryKey: ["client-conversations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_conversations")
        .select("*, contact:contacts(id,name), project:projects(id,name)")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["client-contacts-mini", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts").select("id,name").eq("client_id", clientId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["client-projects-mini", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("id,name").eq("client_id", clientId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); setOpen(false); };

  const openNew = () => { setForm(emptyForm()); setEditingId(null); setOpen(true); };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      channel: c.channel,
      subject: c.subject,
      summary: c.summary,
      participants: c.participants ?? "",
      occurred_at: toLocalInputValue(new Date(c.occurred_at)),
      follow_up_at: c.follow_up_at ? toLocalInputValue(new Date(c.follow_up_at)) : "",
      contact_id: c.contact_id ?? "",
      project_id: c.project_id ?? "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.subject.trim() || !form.summary.trim()) return;
    setSaving(true);
    const payload = {
      client_id: clientId,
      channel: form.channel,
      subject: form.subject.trim(),
      summary: form.summary.trim(),
      participants: form.participants.trim() || null,
      occurred_at: new Date(form.occurred_at).toISOString(),
      follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
      contact_id: form.contact_id || null,
      project_id: form.project_id || null,
    };
    const { error } = editingId
      ? await supabase.from("client_conversations").update(payload).eq("id", editingId)
      : await supabase.from("client_conversations").insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Updated" : "Logged");
    qc.invalidateQueries({ queryKey: ["client-conversations", clientId] });
    resetForm();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("client_conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["client-conversations", clientId] });
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {convos.length} conversation{convos.length === 1 ? "" : "s"} logged
        </p>
        {!open && (
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Log conversation
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={save} className="mb-8 rounded-lg border border-border p-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setForm({ ...form, channel: c.value })}
                className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded border transition ${
                  form.channel === c.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.icon}{c.label}
              </button>
            ))}
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1" placeholder="e.g. Kickoff meeting, Pricing follow-up" required />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Summary</Label>
            <ImageTextarea value={form.summary} onValueChange={(v) => setForm({ ...form, summary: v })} className="mt-1 min-h-[120px]" placeholder="What was discussed, decisions, action items…" required />
          </div>
          <div>
            <Label className="text-xs">When</Label>
            <Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} className="mt-1" required />
          </div>
          <div>
            <Label className="text-xs">Follow up (optional)</Label>
            <Input type="datetime-local" value={form.follow_up_at} onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Participants</Label>
            <Input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} className="mt-1" placeholder="Names, comma separated" />
          </div>
          <div>
            <Label className="text-xs">Contact</Label>
            <select
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Project (optional)</Label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Log conversation"}
            </Button>
          </div>
        </form>
      )}

      {convos.length === 0 ? (
        <EmptyTab icon={<MessageSquare className="h-8 w-8" />} title="No conversations yet" hint="Log calls, meetings, and emails to keep a shared history." />
      ) : (
        <ol className="relative border-l border-border pl-6 space-y-6">
          {convos.map((c) => {
            const ch = CHANNELS.find((x) => x.value === c.channel) ?? CHANNELS[0];
            const canEdit = isAdmin || c.created_by === user?.id;
            return (
              <li key={c.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground">
                  {ch.icon}
                </span>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {ch.label} · {format(new Date(c.occurred_at), "PPp")}
                    </p>
                    <h4 className="mt-1 font-display text-base font-semibold">{c.subject}</h4>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(c.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                <Markdown className="mt-2">{c.summary}</Markdown>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {c.participants && <span>With: {c.participants}</span>}
                  {c.contact && <span>Contact: {c.contact.name}</span>}
                  {c.project && <span>Project: {c.project.name}</span>}
                  {c.follow_up_at && (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <CalendarClock className="h-3 w-3" /> Follow up {format(new Date(c.follow_up_at), "PP")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

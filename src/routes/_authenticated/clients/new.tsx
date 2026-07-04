import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/new")({
  component: NewClient,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(140),
  website: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(80).optional(),
  status: z.enum(["lead", "contacted", "proposal", "active", "won", "lost", "paused", "archived"]),
  notes: z.string().trim().max(2000).optional(),
});

function NewClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    website: "",
    industry: "",
    status: "lead" as "lead" | "contacted" | "proposal" | "active" | "won" | "lost" | "paused" | "archived",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        created_by: user.id,
        name: parsed.data.name,
        website: parsed.data.website || null,
        industry: parsed.data.industry || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client added");
    router.navigate({ to: "/clients/$clientId", params: { clientId: data.id } });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <button
        onClick={() => router.history.back()}
        className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">New client</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Add a client to the roster.</h1>

      <form onSubmit={save} className="mt-8 space-y-6">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-11" placeholder="Acme Inc." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1.5 h-11" placeholder="SaaS" />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1.5 h-11" placeholder="acme.com" />
          </div>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <optgroup label="Pipeline">
              <option value="lead">Lead</option>
              <option value="contacted">Contacted</option>
              <option value="proposal">Proposal</option>
              <option value="active">Active</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </optgroup>
            <optgroup label="Off pipeline">
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </optgroup>
          </select>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5 min-h-[140px]" placeholder="Anything the team should know about this client." />
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={saving} className="h-11 px-6">
            {saving ? "Saving…" : "Create client"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.history.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

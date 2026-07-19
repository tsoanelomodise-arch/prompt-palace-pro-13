import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClipboardCopy, Mail } from "lucide-react";
import { toast } from "sonner";

type Cred = {
  id: string;
  label: string;
  system: string | null;
  url: string | null;
  username: string | null;
  notes: string | null;
};

async function buildBlock(cred: Cred, clientName?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("credential_reveal", { _id: cred.id });
  if (error) throw new Error(error.message);
  const password = (data as string | null) ?? "";
  const lines = [
    `Login: ${cred.label}`,
    clientName ? `Client: ${clientName}` : null,
    cred.system ? `System: ${cred.system}` : null,
    cred.url ? `URL: ${cred.url}` : null,
    cred.username ? `Username: ${cred.username}` : null,
    password ? `Password: ${password}` : `Password: (none stored)`,
    cred.notes ? `\nNotes:\n${cred.notes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function CredentialShareActions({
  cred,
  clientName,
}: {
  cred: Cred;
  clientName?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleCopy = async () => {
    setBusy(true);
    try {
      const block = await buildBlock(cred, clientName);
      await navigator.clipboard.writeText(block);
      toast.success("Login details copied", {
        description: "Paste into your message. Handle with care.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy login");
    } finally {
      setBusy(false);
    }
  };

  const openEmail = async () => {
    setEmailOpen(true);
    setLoadingPreview(true);
    try {
      const block = await buildBlock(cred, clientName);
      setPreview(block);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load login");
      setEmailOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendMail = () => {
    if (!to.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    const subject = `Login details: ${cred.label}${clientName ? ` (${clientName})` : ""}`;
    const body = preview;
    const href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setEmailOpen(false);
    setTo("");
    toast.success("Opening your email client…");
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        disabled={busy}
        title="Copy all details to share"
      >
        <ClipboardCopy className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={openEmail}
        disabled={busy}
        title="Email these credentials"
      >
        <Mail className="h-4 w-4" />
      </Button>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Email login details</DialogTitle>
            <DialogDescription>
              Opens your email client with the credentials pre-filled. Review before sending — passwords are
              sent in plain text.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cred-email-to" className="text-xs">Recipient email</Label>
              <Input
                id="cred-email-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="person@example.com"
                className="mt-1 h-10"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Message preview (editable)</Label>
              <Textarea
                value={loadingPreview ? "Loading…" : preview}
                onChange={(e) => setPreview(e.target.value)}
                className="mt-1 min-h-[180px] font-mono text-xs"
                disabled={loadingPreview}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button onClick={sendMail} disabled={loadingPreview || !to.trim()}>
              <Mail className="h-4 w-4 mr-1.5" /> Open in email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

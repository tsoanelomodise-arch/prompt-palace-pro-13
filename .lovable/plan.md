Transform the Prompt Library into a **CRM Lite** for a digital agency: clients, projects, contacts, encrypted credentials, notes — with prompts attachable to clients/projects, and admin/member roles.

## What gets added

### 1. Data model (one migration)

```text
clients         id, name, slug, website, industry, status (active/paused/archived), notes, created_by
projects        id, client_id, name, status, starts_on, ends_on, notes
contacts        id, client_id, name, role, email, phone, notes
credentials     id, client_id, project_id?, label, system, url, username,
                secret_encrypted (bytea, pgsodium), notes, last_rotated_at
client_notes    id, client_id, project_id?, body, created_by
user_roles      id, user_id, role (app_role enum: admin | member)
prompts (existing) + client_id?, project_id?  ← optional FKs
```

All tables get `created_at`, `updated_at`, `set_updated_at` trigger, GRANTs to `authenticated` + `service_role`, RLS enabled.

### 2. Roles + security
- `app_role` enum + `user_roles` table + `has_role(uuid, app_role)` SECURITY DEFINER function (per project rule: roles never live on profiles).
- First signed-in user is auto-promoted to `admin` via a one-shot bootstrap server fn (idempotent: only runs when zero admins exist).
- RLS:
  - Clients/projects/contacts/notes: any `authenticated` user reads; only `admin` or the row creator can update/delete; any `authenticated` can insert.
  - `credentials`: SELECT/INSERT/UPDATE/DELETE restricted to `admin` only at the RLS layer. Members never touch the table directly.
  - `user_roles`: users see their own row; only admins can write.

### 3. Credential encryption (pgsodium)
- Enable `pgsodium` extension.
- `secret_encrypted` stored as `bytea`, encrypted with a server-managed key id.
- All credential reads/writes go through **server functions** (`requireSupabaseAuth` + `has_role('admin')` check), never the browser client. Admin server fn uses `supabaseAdmin` to encrypt/decrypt.
- UI reveals decrypted password only on explicit "Reveal" click → calls `decryptCredential(id)` server fn → shows + copy-to-clipboard, never persisted in React Query cache (kept in component state, cleared on unmount).
- Members see credential metadata (label, url, username) but the reveal button returns 403.

### 4. Navigation / UI (keeps the "Paper & Ink" editorial system)

New sticky-header structure:
```text
[Logo] Clients · Prompts · Team        [+ New ▾]  user · sign out
```

New routes (all under `_authenticated/`):
- `/clients` — table-style list (search, status filter, count of projects/prompts/credentials per row)
- `/clients/new` — create client
- `/clients/$clientId` — client detail with tabs: **Overview · Projects · Contacts · Credentials · Prompts · Notes**
- `/clients/$clientId/credentials/new` (admin only)
- `/clients/$clientId/projects/new`
- `/team` — admin-only: list users, change roles
- Existing `/` (prompts list) gets an optional "Client" filter chip; `/new` (prompt) gets optional client + project selectors; `/$id` (prompt detail) shows linked client.

Member vs admin: admin-only buttons (`+ Credential`, `Reveal`, `Team`) are hidden via `useAuth().role`; server still enforces.

### 5. Server functions (`src/lib/*.functions.ts`)
- `listCredentialsMeta(clientId)` — auth'd, returns metadata only.
- `createCredential`, `updateCredential`, `deleteCredential` — admin-only, encrypt with pgsodium.
- `revealCredential(id)` — admin-only, returns decrypted password once.
- `assignRole(userId, role)`, `listTeam()` — admin-only.
- `bootstrapFirstAdmin()` — runs on first login from root `__root.tsx` effect.

All wrapped with `requireSupabaseAuth` + role check; `supabaseAdmin` imported inside the handler.

### 6. Files touched / created

Created:
- `supabase` migration (enums, tables, grants, RLS, pgsodium, has_role, set_updated_at reuse)
- `src/lib/credentials.functions.ts`, `src/lib/roles.functions.ts`
- `src/routes/_authenticated/clients.tsx` (layout)
- `src/routes/_authenticated/clients/index.tsx`
- `src/routes/_authenticated/clients/new.tsx`
- `src/routes/_authenticated/clients/$clientId.tsx` (tabs)
- `src/routes/_authenticated/team.tsx`
- `src/components/crm/*` — `ClientCard`, `CredentialRow`, `RevealButton`, `RoleBadge`, `TabNav`

Edited:
- `src/routes/_authenticated.tsx` — header nav adds Clients / Team links
- `src/routes/_authenticated/index.tsx` — optional client filter
- `src/routes/_authenticated/new.tsx` + `$id.tsx` — client/project pickers + display
- `src/lib/auth-context.tsx` — expose `role` + `isAdmin`
- `src/start.ts` — confirm `attachSupabaseAuth` middleware (already required)

### 7. Out of scope (explicit, can follow up)
- Inviting users by email (admins assign roles to users who have already signed up).
- Audit log of credential reveals (easy to add later as `credential_access_log`).
- File attachments per client.
- Time tracking / invoicing.

## Open assumption
Members can **see that a credential exists** (label/url/username) but cannot reveal the password. If you'd rather members not see credentials at all, say so and I'll scope the SELECT policy to admins only.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "member";

function isEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: Role }) => {
    const email = (d.email ?? "").trim().toLowerCase();
    if (!isEmail(email)) throw new Error("Invalid email");
    if (email.length > 255) throw new Error("Email too long");
    const role: Role = d.role === "admin" ? "admin" : "member";
    return { email, role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const redirectTo = process.env.SITE_URL || undefined;
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) {
      // If user already exists, look them up and just grant role.
      const msg = error.message || "";
      if (!/already|registered|exists/i.test(msg)) throw new Error(msg);
    }

    let userId = invited?.user?.id;
    if (!userId) {
      // Resolve existing user by email
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw new Error(listErr.message);
      const match = list.users.find((u) => u.email?.toLowerCase() === data.email);
      if (!match) throw new Error("Could not resolve invited user");
      userId = match.id;
    }

    // Ensure member row, plus admin if requested
    const rows: { user_id: string; role: Role }[] = [{ user_id: userId, role: "member" }];
    if (data.role === "admin") rows.push({ user_id: userId, role: "admin" });
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(rows, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId, email: data.email, alreadyExisted: !invited?.user };
  });

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (error) throw new Error(error.message);

    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);

    const byUser: Record<string, { email: string; roles: string[]; invitedAt: string | null; lastSignInAt: string | null; confirmed: boolean }> = {};
    for (const u of list.users) {
      byUser[u.id] = {
        email: u.email ?? "(no email)",
        roles: [],
        invitedAt: u.invited_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmed: !!u.email_confirmed_at || !!u.confirmed_at,
      };
    }
    for (const r of roles ?? []) {
      if (byUser[r.user_id]) byUser[r.user_id].roles.push(r.role);
      else byUser[r.user_id] = { email: "(unknown)", roles: [r.role], invitedAt: null, lastSignInAt: null, confirmed: false };
    }
    return Object.entries(byUser).map(([user_id, v]) => ({ user_id, ...v }));
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!d.userId) throw new Error("userId required");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You can't remove yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

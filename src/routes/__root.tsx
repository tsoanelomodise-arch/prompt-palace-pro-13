import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404 — Not found</p>
        <h1 className="mt-4 font-display text-5xl font-semibold">Lost in the archive</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That page doesn't exist in the library.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to prompts
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Prompt Library — Agency Internal" },
      { name: "description", content: "Internal prompt library for the agency team." },
      { property: "og:title", content: "Prompt Library — Agency Internal" },
      { name: "twitter:title", content: "Prompt Library — Agency Internal" },
      { property: "og:description", content: "Internal prompt library for the agency team." },
      { name: "twitter:description", content: "Internal prompt library for the agency team." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e9f24452-332d-4341-b59b-3afe3f0f6d51/id-preview-6b9865bc--4a5fdf45-6597-4936-b8df-dc0b1140f722.lovable.app-1779017541424.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e9f24452-332d-4341-b59b-3afe3f0f6d51/id-preview-6b9865bc--4a5fdf45-6597-4936-b8df-dc0b1140f722.lovable.app-1779017541424.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthBridge>
          <Outlet />
          <Toaster />
        </AuthBridge>
      </AuthProvider>
    </QueryClientProvider>
  );
}

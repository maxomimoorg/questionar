import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "../components/Header";
import { Onboarding } from "../components/Onboarding";
import { Toaster } from "../components/ui/sonner";
import { DiagnosticsPanel } from "../components/diagnostics/DiagnosticsPanel";
import { DiagnosticsBadge } from "../components/diagnostics/DiagnosticsBadge";
import { PeerProvider } from "../lib/peer";
import { StoreProvider, useStore } from "../lib/store";
import { setupServiceWorker } from "../lib/sw-register";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { title: "QuestionAR" },
      {
        name: "description",
        content:
          "Questionari a slider per misurare la compatibilità tra profili, salvati solo sul tuo dispositivo.",
      },
      { property: "og:title", content: "QuestionAR" },
      {
        property: "og:description",
        content: "Compatibilità tra profili tramite questionari a slider, in locale e offline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0F171E" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Dark by default so the first paint (the "Carico i tuoi dati" screen) is dark before the saved
    // theme is known; the store switches to the user's theme once local data has loaded.
    <html lang="it" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppFrame() {
  const { state, ready } = useStore();

  useEffect(() => {
    setupServiceWorker();
  }, []);

  if (!ready) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-background text-[14px] text-muted-foreground">
        Carico i tuoi dati…
      </div>
    );
  }

  if (!state.identity) return <Onboarding />;

  return (
    <PeerProvider>
      <Header />
      <main className="pb-10">
        <Outlet />
      </main>
    </PeerProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AppFrame />
        <Toaster position="top-center" />
        <DiagnosticsPanel />
        <DiagnosticsBadge />
      </StoreProvider>
    </QueryClientProvider>
  );
}

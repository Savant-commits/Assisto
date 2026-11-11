"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import LoginForm from "@/components/auth/login-form";

type PendingAction = () => void;
type AuthGateContextValue = {
  isAuthenticated: boolean;
  requireAuth: (action: PendingAction, actionLabel?: string) => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function useAuthGate() {
  const context = useContext(AuthGateContext);
  if (!context) throw new Error("useAuthGate must be used within AuthSheetProvider");
  return context;
}

export function AuthSheetProvider({
  children,
  initialIsAuthenticated,
}: {
  children: React.ReactNode;
  initialIsAuthenticated: boolean;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);
  const [isOpen, setIsOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState<string | undefined>();
  const [returnPath, setReturnPath] = useState("/");
  const pendingAction = useRef<PendingAction | null>(null);
  const triggerElement = useRef<HTMLElement | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    pendingAction.current = null;
    setIsOpen(false);
    setActionLabel(undefined);
  }, []);

  const requireAuth = useCallback((action: PendingAction, label?: string) => {
    if (isAuthenticated) {
      action();
      return;
    }

    pendingAction.current = action;
    triggerElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReturnPath(`${window.location.pathname}${window.location.search}`);
    setActionLabel(label);
    setIsOpen(true);
  }, [isAuthenticated]);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        setIsAuthenticated(!!session?.user);
        return;
      }
      if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);
        return;
      }
      if (event !== "SIGNED_IN" || !session) return;

      setIsAuthenticated(true);
      const action = pendingAction.current;
      pendingAction.current = null;
      setIsOpen(false);
      setActionLabel(undefined);
      router.refresh();
      if (action) window.setTimeout(action, 0);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (isOpen) return;
    const target = triggerElement.current;
    if (!target) return;
    triggerElement.current = null;
    const timer = window.setTimeout(() => target.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const contextValue = { isAuthenticated, requireAuth };

  return (
    <AuthGateContext.Provider value={contextValue}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) dismiss();
      }}>
        <DialogContent
          aria-modal="true"
          aria-labelledby="auth-sheet-title"
          role="dialog"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          onTouchStart={(event) => {
            swipeStartY.current = event.target instanceof Element && event.target.closest("[data-auth-sheet-handle]")
              ? event.touches[0]?.clientY ?? null
              : null;
          }}
          onTouchEnd={(event) => {
            const startY = swipeStartY.current;
            swipeStartY.current = null;
            const endY = event.changedTouches[0]?.clientY;
            if (startY !== null && endY !== undefined && endY - startY > 90) dismiss();
          }}
          className="fixed inset-x-0 bottom-0 top-auto m-0 flex max-h-[90dvh] w-screen max-w-none flex-col overflow-y-auto rounded-t-3xl border-border bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lifted animate-in slide-in-from-bottom duration-300 motion-reduce:slide-in-from-bottom-0 motion-reduce:duration-150 md:relative md:inset-auto md:max-h-[min(90dvh,680px)] md:w-full md:max-w-md md:rounded-2xl md:p-6 md:pb-6 md:slide-in-from-bottom-0 md:zoom-in-95 md:motion-reduce:animate-none"
        >
          <div data-auth-sheet-handle className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" aria-hidden="true" />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <DialogTitle id="auth-sheet-title" className="text-xl font-semibold">Sign in to continue</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {actionLabel ? `Sign in ${actionLabel}.` : "Welcome back to Assisto."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close sign in"
              onClick={dismiss}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <LoginForm
            redirectTo={returnPath}
            autoFocusEmail
            onCreateAccount={dismiss}
            onSuccess={() => {
              // SIGNED_IN from Supabase closes the sheet and resumes the pending action.
            }}
          />
        </DialogContent>
      </Dialog>
    </AuthGateContext.Provider>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { NavProvider, useNav } from "@/components/layout/nav-context";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

function ContentArea({ children }: { children: React.ReactNode }) {
  const { isNavigating } = useNav();

  return (
    <main className="relative flex-1 overflow-y-auto p-4 lg:p-6">
      {isNavigating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {children}
    </main>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <NavProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Desktop sidebar — always visible at lg+ */}
        <Sidebar className="hidden lg:flex" />

        {/* Mobile sidebar — Sheet drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div onClick={closeMobile}>
              <Sidebar />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={toggleMobile} />
          <ContentArea>{children}</ContentArea>
        </div>
      </div>
    </NavProvider>
  );
}

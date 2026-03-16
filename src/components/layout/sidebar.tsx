"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNav } from "@/components/layout/nav-context";
import Image from "next/image";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Plane,
  Settings,
  Activity,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Discovery Flights", href: "/discovery", icon: Plane },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigate } = useNav();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }, [router]);

  return (
    <aside
      className={cn(
        "flex h-full w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      {/* Branding */}
      <div className="flex h-14 items-start gap-2.5 px-4 pt-3">
        <Image src="/fsp-logo-icon.png" alt="FSP" width={60} height={60} className="shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight tracking-tight text-foreground">
            AirOps
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground">
            by Flight Schedule Pro
          </span>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors text-left",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <Separator />

      {/* Bottom section — operator info & logout */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          OP
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">Operator Name</p>
          <p className="truncate text-[11px] text-muted-foreground">
            scheduler@example.com
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
    </aside>
  );
}

export { navItems };

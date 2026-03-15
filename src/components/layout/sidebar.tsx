"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
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
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Discovery Flights", href: "/discovery", icon: Plane },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
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
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Plane className="size-5 text-primary" />
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
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
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

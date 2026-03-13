"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navItems } from "@/components/layout/sidebar";

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = navItems.find((item) =>
    item.href === "/" ? false : pathname.startsWith(item.href)
  );
  return match?.label ?? "Dashboard";
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const title = pageTitleFromPath(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Toggle navigation"
      >
        <Menu className="size-5" />
      </Button>

      <h1 className="text-sm font-semibold">{title}</h1>

      {/* Right side — user menu placeholder */}
      <div className="ml-auto flex items-center">
        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          U
        </div>
      </div>
    </header>
  );
}

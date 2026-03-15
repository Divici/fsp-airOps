"use client";

import {
  createContext,
  useContext,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";

interface NavContextValue {
  /** True from the moment a tab is clicked until the new page renders */
  isNavigating: boolean;
  /** Navigate to a route with transition tracking */
  navigate: (href: string) => void;
}

const NavContext = createContext<NavContextValue>({
  isNavigating: false,
  navigate: () => {},
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      if (href === pathname) return;
      startTransition(() => {
        router.push(href);
      });
    },
    [router, pathname, startTransition]
  );

  const value = useMemo(
    () => ({ isNavigating: isPending, navigate }),
    [isPending, navigate]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}

/**
 * Drop-in replacement for Next.js <Link> that triggers the content-area
 * loading spinner via the NavProvider transition.
 */
export function NavLink({
  href,
  children,
  className,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
}) {
  const { navigate } = useNav();

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { DesktopNav, MobileNav } from "@/components/navigation/Navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return <>{children}</>;
  return <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]"><DesktopNav/><div className="min-h-screen lg:pl-60">{children}</div><MobileNav/></div>;
}

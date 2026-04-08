"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Truck, ClipboardList, BarChart3 } from "lucide-react";

const NAV = [
  { label: "Обзор", href: "/mobile", Icon: LayoutDashboard },
  { label: "Флот", href: "/mobile/fleet", Icon: Truck },
  { label: "Заявки", href: "/mobile/tasks", Icon: ClipboardList },
  { label: "Аналитика", href: "/mobile/analytics", Icon: BarChart3 },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* React 19 hoists <meta> to <head> automatically */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />

      <div
        style={{
          height: "100dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#0d1117",
          position: "relative",
        }}
      >
        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingBottom: 72,
            WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          }}
        >
          {children}
        </div>

        {/* Bottom navigation bar */}
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            background: "#161b22",
            borderTop: "1px solid #21262d",
            display: "flex",
            alignItems: "stretch",
            zIndex: 9999,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {NAV.map(({ label, href, Icon }) => {
            const active = href === "/mobile" ? pathname === "/mobile" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  color: active ? "#d4a017" : "#484f58",
                  textDecoration: "none",
                  WebkitTapHighlightColor: "transparent",
                  minHeight: 44,
                  transition: "color 0.15s",
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.02em" }}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

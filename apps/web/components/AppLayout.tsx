
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar, MobileSidebar } from "./AppSidebar";
import { AnimatedBackground } from "./AnimatedBackground";
import CopilotSidebarChat from "./CopilotSidebarChat";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";
import { clearAuthSession, persistAuthTokens, refreshAuthSession } from "@/lib/auth";
import { readFinanceAuthToken } from "@/lib/runtime-config";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isChat = pathname === "/chat" || searchParams.get("tab") === "copilot";
    const authMode = searchParams.get("auth");
    const isAuthScreen = authMode === "login" || authMode === "callback" || pathname.startsWith("/auth/");
    const isDesktopEmbed = false;
    const [collapsed, setCollapsed] = useState(false);
    const [copilotRailOpen, setCopilotRailOpen] = useState(false);

    useEffect(() => {
        if (isAuthScreen) return;
        const authToken = readFinanceAuthToken();
        if (!authToken) return;

        let cancelled = false;
        const refreshEveryMs = 4 * 60 * 1000;

        async function refreshSession() {
          try {
            const result = await refreshAuthSession();
            if (cancelled) return;
            persistAuthTokens(result.tokens);
          } catch {
            if (cancelled) return;
            clearAuthSession();
            const currentQuery = searchParams.toString();
            const currentLocation = `${pathname}${currentQuery ? `?${currentQuery}` : ""}`;
            const returnTo = encodeURIComponent(currentLocation || "/?tab=dashboard");
            router.replace(`/?auth=login&returnTo=${returnTo}`);
          }
        }

        const timer = window.setInterval(() => {
          void refreshSession();
        }, refreshEveryMs);

        return () => {
          cancelled = true;
          window.clearInterval(timer);
        };
    }, [isAuthScreen, pathname, router, searchParams]);

    if (isAuthScreen || (!readFinanceAuthToken() && pathname === "/")) {
        return <div className="min-h-screen bg-background">{children}</div>;
    }

    const leftPadding = isDesktopEmbed ? "md:pl-0" : collapsed ? "md:pl-20" : "md:pl-64";
    const rightPadding =
        !isDesktopEmbed && !isChat
            ? copilotRailOpen
                ? "md:pr-80"
                : "md:pr-12"
            : "md:pr-0";

    return (
        <div className="flex h-screen md:h-screen sm:h-[100dvh] bg-background overflow-hidden relative z-0">
            <AnimatedBackground />
            <NotificationBell />

            {/* Desktop Sidebar - Fixed width, hidden on mobile */}
            {!isDesktopEmbed && (
                <div className="hidden md:flex flex-col fixed inset-y-0 z-50 h-full">
                    <AppSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
                </div>
            )}

            {!isDesktopEmbed && !isChat && (
                <div className="hidden md:flex fixed inset-y-0 right-0 z-40 h-full">
                    <div
                        className={cn(
                            "copilot-rail h-full transition-all duration-300",
                            copilotRailOpen ? "w-80" : "w-12"
                        )}
                    >
                        <div className="h-full min-h-0 flex flex-col">
                            <div className="copilot-rail-header px-2.5 py-2.5 flex items-center justify-between gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="copilot-rail-toggle"
                                    onClick={() => setCopilotRailOpen((prev) => !prev)}
                                    title={copilotRailOpen ? "Cerrar panel Copilot" : "Abrir panel Copilot"}
                                >
                                    {copilotRailOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                                </Button>
                                {copilotRailOpen && (
                                    <Link href="/chat" className="copilot-rail-link">
                                        Abrir chat completo
                                    </Link>
                                )}
                            </div>
                            {copilotRailOpen ? (
                                <CopilotSidebarChat />
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <Bot className="h-5 w-5 text-cyan-400/80" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area - Offset by sidebar widths on desktop */}
            <div className={cn(
                "flex-1 flex flex-col h-full w-full transition-all duration-300",
                leftPadding,
                rightPadding
            )}>

                {/* Mobile Header - Visible only on mobile */}
                {!isDesktopEmbed && (
                    <div className="md:hidden flex items-center h-14 px-4 border-b bg-zinc-900 border-zinc-800 shrink-0 z-40 relative">
                        <MobileSidebar />
                        <span className="ml-3 font-bold text-white text-lg">FinanceSystem</span>
                    </div>
                )}

                {/* Scrollable Page Content 
                    - If Chat: overflow-hidden (Chat handles its own scroll)
                    - If other: overflow-y-auto
                */}
                <main className={cn(
                    "flex-1 min-h-0 relative",
                    isChat && !isDesktopEmbed ? "overflow-hidden" : "overflow-y-auto"
                )}>
                    {children}
                </main>
            </div>
        </div>
    );
}

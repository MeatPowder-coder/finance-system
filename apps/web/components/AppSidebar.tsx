"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PieChart,
  Receipt,
  Settings,
  Wallet,
  Zap,
} from "lucide-react";
import { ThemeSelector } from "@/components/ThemeSelector";
import { BackendStatusPill } from "@/components/BackendStatusPill";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type ComponentType } from "react";
import { clearAuthSession } from "@/lib/auth";

type FinanceTab = "dashboard" | "accounts" | "transactions" | "reports" | "investments" | "planning" | "copilot" | "settings";

const financeRoutes: Array<{
  label: string;
  href: string;
  tab?: FinanceTab;
  iconComponent: ComponentType<{ className?: string }>;
}> = [
  { label: "Dashboard", href: "/?tab=dashboard", tab: "dashboard", iconComponent: LayoutDashboard },
  { label: "Cuentas", href: "/?tab=accounts", tab: "accounts", iconComponent: Wallet },
  { label: "Transacciones", href: "/?tab=transactions", tab: "transactions", iconComponent: Receipt },
  { label: "Reportes", href: "/?tab=reports", tab: "reports", iconComponent: BarChart3 },
  { label: "Inversiones", href: "/?tab=investments", tab: "investments", iconComponent: PieChart },
  { label: "Planificacion", href: "/?tab=planning", tab: "planning", iconComponent: CalendarDays },
  { label: "Copilot", href: "/?tab=copilot", tab: "copilot", iconComponent: MessageSquare },
  { label: "Configuracion", href: "/?tab=settings", tab: "settings", iconComponent: Settings },
];

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") as FinanceTab | null) || "dashboard";
  const routes = financeRoutes.map((route) => ({
    ...route,
    active:
      route.href === "/?tab=copilot"
        ? (pathname === "/" && currentTab === route.tab) || pathname === "/chat"
        : pathname === "/" && currentTab === route.tab,
  }));

  return (
    <div
      className={cn(
        "space-y-4 pt-14 pb-4 flex flex-col h-full text-white transition-all duration-300 overflow-x-hidden",
        collapsed ? "items-center" : ""
      )}
    >
      <div className="px-3 py-2 flex-1 w-full">
        <Link href="/" className={cn("flex items-center mb-14 pl-3 transition-all", collapsed ? "justify-center pl-0" : "")}>
          <div className="relative h-8 w-8 bg-gradient-to-br from-cyan-300 to-fuchsia-300 text-black p-1.5 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          {!collapsed && <h1 className="text-xl font-bold ml-4 animate-in fade-in duration-300 truncate tracking-tight">FinanceSystem</h1>}
        </Link>
        <div className="space-y-1 w-full">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              title={collapsed ? route.label : undefined}
              className={cn(
                "text-sm group flex p-3 w-full font-medium cursor-pointer rounded-lg transition-all relative",
                route.active ? "text-white bg-cyan-500/15 border border-cyan-500/30" : "text-zinc-400 hover:text-white hover:bg-white/8",
                collapsed ? "justify-center" : "justify-start"
              )}
            >
              {route.active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-cyan-400" />}
              <div className="flex items-center">
                <route.iconComponent
                  className={cn(
                    "h-5 w-5 shrink-0",
                    collapsed ? "" : "mr-3",
                    route.active ? "text-cyan-300" : "text-zinc-400 group-hover:text-cyan-300"
                  )}
                />
                {!collapsed && <span className="truncate">{route.label}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className={cn("px-3 py-2 border-t border-zinc-800 w-full", collapsed ? "flex flex-col items-center" : "")}>
        {!collapsed && (
          <div className="mb-3">
            <BackendStatusPill />
          </div>
        )}
        <div className={cn("mb-3", collapsed ? "flex justify-center" : "")}>
          <Button
            type="button"
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            className={cn(
              "border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800 hover:text-white",
              collapsed ? "h-9 w-9" : "w-full"
            )}
            onClick={() => {
              clearAuthSession();
              router.replace("/?auth=login");
            }}
          >
            {!collapsed ? "Cerrar sesion" : "Salir"}
          </Button>
        </div>
        <div className={cn("flex items-center transition-all duration-300", collapsed ? "justify-center" : "px-2")}>
          <ThemeSelector collapsed={collapsed} />
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({
  className,
  collapsed,
  onCollapsedChange,
}: {
  className?: string;
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col h-full ui-panel transition-[width] duration-300 ease-out z-50 overflow-x-hidden",
        className,
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            "h-9 rounded-full border border-zinc-700/80 bg-zinc-900/90 text-zinc-200 hover:text-white hover:border-cyan-500/70",
            "flex items-center gap-1.5 px-3 shadow-lg shadow-black/30 transition-all"
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
          title={collapsed ? "Expandir" : "Contraer"}
        >
          <Menu className="h-4 w-4" />
          {!collapsed && <span className="text-xs font-medium">Menu</span>}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className={cn(
          "absolute -right-3 top-14 h-6 w-6 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-500 flex items-center justify-center shadow-md",
          "transition-colors"
        )}
        aria-hidden
        tabIndex={-1}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
      <SidebarContent collapsed={collapsed} />
    </div>
  );
}

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-zinc-800">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 bg-zinc-900 border-r-zinc-800 w-72 text-white border-none flex flex-col">
        <div className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
          <SheetDescription>Main application navigation</SheetDescription>
        </div>
        <SidebarContent collapsed={false} />
      </SheetContent>
    </Sheet>
  );
}

export type JournalIconKey =
  | "layout-dashboard"
  | "trending-up"
  | "pie-chart"
  | "wallet"
  | "receipt"
  | "bell"
  | "message-square"
  | "folder-open"
  | "candlestick-chart"
  | "radar"
  | "user-round"
  | "wallet-cards"
  | "circle-dollar-sign"
  | "bell-ring"
  | "message-square-more";

export type JournalWebSidebarRoute = {
  label: string;
  icon: JournalIconKey;
  href: string;
  pathname: string;
  tab?: string;
};

export const JOURNAL_WEB_SIDEBAR_ROUTES: JournalWebSidebarRoute[] = [
  {
    label: "Resumen",
    icon: "layout-dashboard",
    href: "/?tab=dashboard",
    pathname: "/",
    tab: "dashboard",
  },
  {
    label: "Cuentas",
    icon: "wallet",
    href: "/?tab=accounts",
    pathname: "/",
    tab: "accounts",
  },
  {
    label: "Transacciones",
    icon: "receipt",
    href: "/?tab=transactions",
    pathname: "/",
    tab: "transactions",
  },
  {
    label: "Inversiones",
    icon: "pie-chart",
    href: "/?tab=investments",
    pathname: "/",
    tab: "investments",
  },
  {
    label: "Copilot",
    icon: "message-square",
    href: "/?tab=copilot",
    pathname: "/",
    tab: "copilot",
  },
];

export function isWebSidebarRouteActive(
  route: JournalWebSidebarRoute,
  pathname: string,
  currentTab: string | null
) {
  if (route.pathname !== pathname) return false;
  if (!route.tab) return !currentTab || currentTab === "dashboard";
  return currentTab === route.tab;
}

export type DashboardSnapshot = {
  totalTrades: number;
  openTrades: number;
  pendingOrders: number;
};

export function buildDashboardSnapshotFromWebTrades(trades: any[]): DashboardSnapshot {
  const list = Array.isArray(trades) ? trades : [];
  const openTrades = list.filter((t) => String(t?.estado || "").toUpperCase() === "OPEN").length;
  const pendingOrders = list.filter((t) => String(t?.entry_order_status || "").toUpperCase() === "PENDING").length;

  return {
    totalTrades: list.length,
    openTrades,
    pendingOrders,
  };
}

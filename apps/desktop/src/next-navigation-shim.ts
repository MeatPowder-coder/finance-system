import { useSyncExternalStore } from "react";

const NAVIGATION_EVENT = "desktop-next-navigation";

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener("popstate", handler);
  window.addEventListener(NAVIGATION_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener("popstate", handler);
    window.removeEventListener(NAVIGATION_EVENT, handler as EventListener);
  };
}

function emitNavigation() {
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

function getCurrentLocation() {
  return window.location.pathname + window.location.search;
}

function navigate(url: string, replace = false) {
  if (replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
  emitNavigation();
}

export function usePathname() {
  const current = useSyncExternalStore(subscribe, getCurrentLocation, getCurrentLocation);
  return current.split("?")[0] || "/";
}

export function useSearchParams() {
  const current = useSyncExternalStore(subscribe, getCurrentLocation, getCurrentLocation);
  const query = current.includes("?") ? current.slice(current.indexOf("?")) : "";
  return new URLSearchParams(query);
}

export function useRouter() {
  return {
    push: (url: string, _options?: unknown) => navigate(url, false),
    replace: (url: string, _options?: unknown) => navigate(url, true),
    refresh: () => emitNavigation(),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    prefetch: async () => undefined,
  };
}

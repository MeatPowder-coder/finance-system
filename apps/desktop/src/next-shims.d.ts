declare module "next/navigation" {
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useRouter(): {
    push: (url: string, options?: unknown) => void;
    replace: (url: string, options?: unknown) => void;
    refresh: () => void;
    back: () => void;
    forward: () => void;
    prefetch: (url: string) => Promise<void>;
  };
}

declare module "next/link" {
  import * as React from "react";
  const Link: React.ForwardRefExoticComponent<
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string } & React.RefAttributes<HTMLAnchorElement>
  >;
  export default Link;
}

import { AnchorHTMLAttributes, MouseEvent, forwardRef } from "react";
import { useRouter } from "next/navigation";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function LinkShim({ href, onClick, ...props }, ref) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (props.target && props.target !== "_self") return;
    event.preventDefault();
    router.push(href);
  }

  return <a ref={ref} href={href} onClick={handleClick} {...props} />;
});

export default Link;

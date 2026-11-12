import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

// Interní odkazy (začínají „/“) jdou přes next/link bez prefetche
// (prefetch může u chráněných rout vyvolat auth dialog); ostatní zůstávají <a>.
export function A({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (typeof href === "string" && href.startsWith("/")) {
    return (
      <Link href={href} prefetch={false} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

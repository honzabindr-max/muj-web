// INTERNAL MODEL TOGGLE helper: renders server-side content in BOTH model variants as sibling elements
// (data-m="claude" / data-m="codex"); CSS in astroroast.css hides the inactive one. Temporary, see docs/astroroast/SPEC.md.
// With MODEL_TOGGLE_ENABLED = false only the claude variant is rendered (no hidden codex HTML, no wrapper when `as` is omitted).
//
//   <T as="h2" className="ar-h2">{(c) => c.landing.howTitle}</T>        -> two <h2>, one hidden
//   <T>{(c, m) => <section>...</section>}</T>                           -> two display:contents wrappers

import type { CSSProperties, ElementType, ReactNode } from "react";
import { COPY, MODEL_TOGGLE_ENABLED, type UiCopy } from "@/astroroast/copy";
import { MODEL_IDS, type ModelId } from "@/astroroast/types";

interface TProps {
  children: (copy: UiCopy, model: ModelId) => ReactNode;
  /** Element to render per variant. Omit to use a layout-neutral (display: contents) wrapper. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

export function T({ children, as, className, style }: TProps) {
  const render = (m: ModelId) => children(COPY[m], m);
  if (!MODEL_TOGGLE_ENABLED) {
    const content = render("claude");
    if (!as) return <>{content}</>;
    const Tag = as;
    return (
      <Tag className={className} style={style}>
        {content}
      </Tag>
    );
  }
  return (
    <>
      {MODEL_IDS.map((m) => {
        const Tag = as ?? "div";
        const extra = as ? {} : { "data-ct": "" };
        return (
          <Tag key={m} data-m={m} className={className} style={style} {...extra}>
            {render(m)}
          </Tag>
        );
      })}
    </>
  );
}

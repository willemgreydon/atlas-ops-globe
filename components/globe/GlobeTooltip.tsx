"use client";
import { useSyncExternalStore } from "react";
import { getHover, subscribeHover, type HoverInfo } from "@/lib/globe/hover";

/**
 * Cursor-following hover tooltip (mission §63). Reads the imperative hover
 * channel via `useSyncExternalStore` so pointer updates never re-render the app
 * tree — only this leaf. Positioned to avoid the viewport edges.
 */
export default function GlobeTooltip() {
  const hover = useSyncExternalStore(subscribeHover, getHover, () => null as HoverInfo | null);
  if (!hover) return null;

  // Flip the tooltip to the opposite side of the cursor near the right/bottom edge.
  const flipX = typeof window !== "undefined" && hover.x > window.innerWidth - 240;
  const flipY = typeof window !== "undefined" && hover.y > window.innerHeight - 120;
  const style: React.CSSProperties = {
    left: hover.x,
    top: hover.y,
    transform: `translate(${flipX ? "calc(-100% - 16px)" : "16px"}, ${flipY ? "calc(-100% - 16px)" : "16px"})`,
  };

  return (
    <div className="globe-tooltip" style={style} role="tooltip" aria-live="polite">
      <span className="globe-tooltip-kind" style={hover.color ? { color: hover.color } : undefined}>
        {hover.kind}
      </span>
      <span className="globe-tooltip-title">{hover.title}</span>
      {hover.subtitle ? <span className="globe-tooltip-sub">{hover.subtitle}</span> : null}
    </div>
  );
}

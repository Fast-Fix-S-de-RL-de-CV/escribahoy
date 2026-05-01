"use client";

export function CanvasPreview({
  widthIn,
  heightIn,
  previewHeight = 64,
  selected,
}: {
  widthIn: number;
  heightIn: number;
  previewHeight?: number;
  selected?: boolean;
}) {
  const aspect = widthIn / heightIn;
  const w = previewHeight * aspect;
  return (
    <div
      className={`flex-shrink-0 rounded-sm shadow-sm border ${
        selected
          ? "border-[var(--color-accent)] bg-white"
          : "border-[var(--color-border-strong)] bg-[var(--color-bg)]"
      }`}
      style={{ height: previewHeight, width: w }}
      aria-label={`${widthIn}″ x ${heightIn}″`}
    />
  );
}

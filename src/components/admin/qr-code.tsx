import { encode } from "uqr";

/** QR code drawn as SVG cells; always dark on white so phone cameras read it in both themes. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value);
  const cells = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])));
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className="size-44 rounded-lg border bg-white"
      shapeRendering="crispEdges"
    >
      <path d={cells.join("")} fill="#1f1e1b" />
    </svg>
  );
}

import { ImageResponse } from "next/og";

// Maskable icons get cropped to a circle/squircle by Android, so the glyph stays inside the safe zone.
export function makeIcon(size: number, maskable = false) {
  const glyph = Math.round(size * (maskable ? 0.4 : 0.55));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#ffffff",
          fontSize: glyph,
          fontWeight: 700,
          borderRadius: maskable ? 0 : Math.round(size * 0.2),
        }}
      >
        AS
      </div>
    ),
    { width: size, height: size },
  );
}

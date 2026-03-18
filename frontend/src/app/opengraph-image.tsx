import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background:
            "radial-gradient(circle at 20% 20%, rgba(66,219,141,0.35), transparent 42%), radial-gradient(circle at 85% 12%, rgba(245,173,50,0.35), transparent 45%), linear-gradient(165deg, #07110f 0%, #112724 48%, #193631 100%)",
          color: "#f3fbf8",
          fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              border: "2px solid rgba(243,251,248,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            ⚡
          </div>
          <p style={{ fontSize: 40, margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>FlashDot</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>
            Bonded Cross-Chain
            <br />
            Flash Liquidity
          </p>
          <p style={{ margin: 0, fontSize: 30, opacity: 0.9 }}>
            One signature. Multi-chain execution. Bond-backed lender safety.
          </p>
        </div>

        <p style={{ margin: 0, fontSize: 24, opacity: 0.85 }}>Built for Polkadot Hub EVM</p>
      </div>
    ),
    {
      ...size,
    }
  );
}

interface FlashDotMarkProps {
  className?: string;
  variant?: "full" | "compact";
}

export function FlashDotMark({ className, variant = "full" }: FlashDotMarkProps): JSX.Element {
  if (variant === "compact") {
    // Compact: mint circle + white lightning bolt (24–48px)
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#42DB8D" />
        <path
          d="M18 4L10 17H16L13 28L23 13H17L20 4H18Z"
          fill="#0B1E1A"
          fillOpacity="0.9"
        />
      </svg>
    );
  }

  // Full mark: chart bars + lightning + dot grid accent (48px+)
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background */}
      <rect x="8" y="8" width="112" height="112" rx="24" fill="#0B1523" />

      {/* Subtle dot grid (Polkadot connectivity motif) */}
      <circle cx="28" cy="28" r="2" fill="#EAFBF5" fillOpacity="0.1" />
      <circle cx="46" cy="28" r="2" fill="#EAFBF5" fillOpacity="0.1" />
      <circle cx="28" cy="46" r="2" fill="#EAFBF5" fillOpacity="0.1" />
      <circle cx="46" cy="46" r="2" fill="#EAFBF5" fillOpacity="0.1" />

      {/* Inner border accent */}
      <rect x="14" y="14" width="100" height="100" rx="18" stroke="#EAFBF5" strokeOpacity="0.1" strokeWidth="1.5" />

      {/* Chart bars — simplified, clean */}
      <rect x="28" y="82" width="12" height="22" rx="4" fill="#1E5947" />
      <rect x="44" y="66" width="12" height="38" rx="4" fill="#297A60" />
      <rect x="60" y="50" width="12" height="54" rx="4" fill="#35A07E" />
      <rect x="76" y="34" width="12" height="70" rx="4" fill="#42DB8D" />

      {/* Trend line */}
      <path
        d="M34 82L50 68L66 54L82 40"
        stroke="#CFFCE5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.7"
      />

      {/* Lightning bolt */}
      <path
        d="M69 16L50 55H64L54 100L89 48H74L84 16H69Z"
        fill="#F5AD32"
        stroke="#FFF3CF"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

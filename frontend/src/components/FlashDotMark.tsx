interface FlashDotMarkProps {
  className?: string;
}

export function FlashDotMark({ className }: FlashDotMarkProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="8" y="8" width="112" height="112" rx="28" fill="#0B1523" />
      <path
        d="M20 99C33 89 43 78 51 68C59 58 68 45 84 28"
        stroke="#163B33"
        strokeOpacity="0.7"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M34 96C47 84 58 72 67 60C75 49 84 38 97 24"
        stroke="#132A46"
        strokeOpacity="0.85"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <rect x="14" y="14" width="100" height="100" rx="22" stroke="#EAFBF5" strokeOpacity="0.14" strokeWidth="2" />
      <path d="M24 92H104" stroke="#EAFBF5" strokeOpacity="0.08" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 69H104" stroke="#EAFBF5" strokeOpacity="0.06" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 46H104" stroke="#EAFBF5" strokeOpacity="0.05" strokeWidth="2" strokeLinecap="round" />
      <rect x="29" y="77" width="10" height="21" rx="3" fill="#214E43" />
      <rect x="43" y="64" width="10" height="34" rx="3" fill="#2A6656" />
      <rect x="57" y="48" width="10" height="50" rx="3" fill="#33856D" />
      <rect x="71" y="35" width="10" height="63" rx="3" fill="#42DB8D" />
      <path
        d="M29 86L48 71L61 58L76 43"
        stroke="#CFFCE5"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.82"
      />
      <path
        d="M67 18L47 54H63L53 98L86 49H69L79 18H67Z"
        fill="#FFB347"
        stroke="#FFF3CF"
        strokeOpacity="0.24"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M29 33H52" stroke="#EAFBF5" strokeOpacity="0.12" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M29 40H61" stroke="#EAFBF5" strokeOpacity="0.14" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

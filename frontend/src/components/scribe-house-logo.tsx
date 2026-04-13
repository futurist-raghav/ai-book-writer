export const ScribeHouseLogo = ({ className = 'h-16 w-16' }: { className?: string }) => (
  <svg
    viewBox="0 0 200 200"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* House outline */}
    <path
      d="M40 80L100 30L160 80V160H40V80Z"
      stroke="#1a3a52"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Roof lines */}
    <line x1="100" y1="30" x2="100" y2="60" stroke="#1a3a52" strokeWidth="4" strokeLinecap="round" />
    {/* Pen nib - left side */}
    <path
      d="M70 90L85 120L75 130Z"
      fill="#06b6d4"
      stroke="#06b6d4"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Pen nib - right side */}
    <path
      d="M130 90L115 120L125 130Z"
      fill="#06b6d4"
      stroke="#06b6d4"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Pen point */}
    <path
      d="M100 110L95 140L100 150L105 140Z"
      fill="#06b6d4"
      stroke="#06b6d4"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Book pages - left */}
    <rect x="45" y="85" width="35" height="60" rx="2" stroke="#1a3a52" strokeWidth="3" fill="none" />
    {/* Book pages - right */}
    <rect x="120" y="85" width="35" height="60" rx="2" stroke="#1a3a52" strokeWidth="3" fill="none" />
    {/* Book spine lines */}
    <line x1="55" y1="85" x2="55" y2="145" stroke="#1a3a52" strokeWidth="2" />
    <line x1="75" y1="85" x2="75" y2="145" stroke="#1a3a52" strokeWidth="2" />
    <line x1="130" y1="85" x2="130" y2="145" stroke="#1a3a52" strokeWidth="2" />
    <line x1="150" y1="85" x2="150" y2="145" stroke="#1a3a52" strokeWidth="2" />
  </svg>
);

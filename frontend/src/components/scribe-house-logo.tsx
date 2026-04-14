import Image from 'next/image';

export const ScribeHouseLogo = ({ className = 'h-16 w-16' }: { className?: string }) => (
  <div className={className}>
    <Image
      src="/scribe-house-logo.png"
      alt="Scribe House Logo"
      width={64}
      height={64}
      className="w-full h-full object-contain"
      priority
    />
  </div>
);

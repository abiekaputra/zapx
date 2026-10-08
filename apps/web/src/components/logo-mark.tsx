export function LogoMark({ title = 'ZapX' }: { title?: string }) {
  return (
    <svg
      aria-label={title}
      className="brand-mark"
      role="img"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="40" rx="10" width="40" />
      <path className="monogram-z" d="M9 10.5h22L12 29.5h20" />
      <path className="monogram-x" d="m14 11 16 18.5" />
    </svg>
  );
}

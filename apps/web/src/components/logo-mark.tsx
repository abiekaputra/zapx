export function LogoMark({ title = 'ZapX' }: { title?: string }) {
  return (
    <svg className="brand-mark" role="img" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      <rect height="40" rx="10" width="40" />
      <path className="monogram-bolt" d="M24.5 8H32l-7.4 8.4H29L14.5 32H8l7.8-8.8h-4.6L24.5 8Z" />
      <path className="monogram-cross" d="m10 9.5 7 7.8m6 5.4 7.5 8.3" />
    </svg>
  );
}

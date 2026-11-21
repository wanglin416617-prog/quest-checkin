export function Icon({ d, size = 22 }: { d: string | readonly string[]; size?: number }) {
  const parts = Array.isArray(d) ? d : [d];
  return (
    <svg
      className="ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {parts.map((part) => (
        <path key={part} d={part} />
      ))}
    </svg>
  );
}

export function Coin() {
  return (
    <svg className="art" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#F0A500" stroke="#C98A00" />
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="#FFF2B8" strokeWidth="1.2" />
    </svg>
  );
}

export function Flame({ dim = false }: { dim?: boolean }) {
  return (
    <svg className="art" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10.2 1.5c.6 3-1.8 4.3-3.3 6.3C5.8 9.2 5 10.6 5 12.4 5 15.6 7.3 18.5 10 18.5s5-2.4 5-5.6c0-2.2-1-3.7-2-4.9-.2 1.3-.8 2.2-1.7 2.6.6-3.4-.2-6.3-1.1-9.1z"
        fill={dim ? "#9AA3B4" : "#FF5A1F"}
      />
    </svg>
  );
}

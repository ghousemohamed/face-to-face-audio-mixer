export function MicIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M17.9 11a.9.9 0 0 0-1.8 0 4.1 4.1 0 0 1-8.2 0 .9.9 0 0 0-1.8 0 5.91 5.91 0 0 0 5 5.83V19H8.6a.9.9 0 0 0 0 1.8h6.8a.9.9 0 0 0 0-1.8H12.9v-2.17a5.91 5.91 0 0 0 5-5.83Z" />
    </svg>
  );
}

export function MicOffIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M15 11V5a3 3 0 0 0-5.9-.74l5.86 5.86A3.1 3.1 0 0 0 15 11Z" />
      <path d="M17.9 11a.9.9 0 0 0-1.8 0 4.06 4.06 0 0 1-.49 1.94l1.32 1.32A5.86 5.86 0 0 0 17.9 11Z" />
      <path d="M4.21 3.54a.9.9 0 0 0-1.27 1.27l6.16 6.16V11a3 3 0 0 0 4.09 2.8l1.06 1.05A4.1 4.1 0 0 1 7.9 11a.9.9 0 0 0-1.8 0 5.91 5.91 0 0 0 5 5.83V19H8.6a.9.9 0 0 0 0 1.8h6.8a.9.9 0 0 0 .5-1.65l3.29 3.3a.9.9 0 0 0 1.27-1.28Z" />
    </svg>
  );
}

export function HangUpIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 8.5c-1.65 0-3.24.25-4.73.72v3.1c0 .39-.23.74-.56.9-.98.49-1.88 1.12-2.67 1.86a.9.9 0 0 1-1.25-.01L.29 12.6a.88.88 0 0 1 0-1.25A16.42 16.42 0 0 1 12 6.5c4.6 0 8.77 1.86 11.79 4.85a.88.88 0 0 1 0 1.25l-2.5 2.47a.9.9 0 0 1-1.25.01 11.27 11.27 0 0 0-2.67-1.86.99.99 0 0 1-.56-.9v-3.1A16.1 16.1 0 0 0 12 8.5Z" />
    </svg>
  );
}

export function SpinnerIcon({ size = 18 }) {
  return (
    <svg className="spinner" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WaveIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x="2.5" y="10" width="2.2" height="4" rx="1.1" />
      <rect x="6.6" y="7" width="2.2" height="10" rx="1.1" />
      <rect x="10.7" y="3.5" width="2.2" height="17" rx="1.1" />
      <rect x="14.8" y="7" width="2.2" height="10" rx="1.1" />
      <rect x="18.9" y="10" width="2.2" height="4" rx="1.1" />
    </svg>
  );
}

export function PeopleIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-2.9 0-7 1.46-7 4.35V20a.8.8 0 0 0 .8.8h12.4a.8.8 0 0 0 .8-.8v-1.85c0-2.89-4.1-4.35-7-4.35Z" />
      <path d="M16.6 12.2a3.6 3.6 0 1 0-2.4-6.29 5.7 5.7 0 0 1 0 6.06c.72.16 1.5.23 2.4.23Zm.3 1.9c-.5 0-1.02.03-1.52.1 1.4.94 2.32 2.28 2.32 4.05v1.35h4.1a.8.8 0 0 0 .8-.8v-1.1c0-2.55-3.34-3.6-5.7-3.6Z" />
    </svg>
  );
}

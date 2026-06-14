// Inline SVG shield-with-keyhole. Self-contained so the Start button paints with
// zero network egress (previously loaded a logo from the third-party host i.ibb.co
// on every page load). Uses currentColor so it follows the taskbar theme.
const StartButtonIcon: FC = () => (
  <div>
    <svg
      aria-label="SecurityOS"
      fill="none"
      height="26"
      role="img"
      viewBox="0 0 24 26"
      width="23"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 1 2 5v7c0 6.1 4.1 11.4 10 12.9C17.9 23.4 22 18.1 22 12V5L12 1Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" fill="currentColor" r="2.4" />
      <path
        d="M12 12.8 13 18h-2l1-5.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  </div>
);

export default StartButtonIcon;

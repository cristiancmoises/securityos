// SecurityOS logo (from the site favicon) as the Start menu launcher icon —
// served same-origin (no third-party egress); themed-button sizing lives in
// StyledStartButton.
const StartButtonIcon: FC = () => (
  <div>
    <img
      alt="SecurityOS"
      draggable={false}
      height={22}
      src="/System/Icons/securityos.webp"
      width={22}
    />
  </div>
);

export default StartButtonIcon;

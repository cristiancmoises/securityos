import { useSession } from "contexts/session";

// Start menu launcher icon, served same-origin (no third-party egress); themed-
// button sizing lives in StyledStartButton. In Undercover mode the SecurityOS
// emblem is swapped for the Windows-style logo so the disguise is convincing.
const StartButtonIcon: FC = () => {
  const { themeName } = useSession();
  const undercover = themeName === "undercover";

  return (
    <div>
      <img
        alt={undercover ? "Start" : "SecurityOS"}
        draggable={false}
        height={22}
        src={
          undercover
            ? "/System/Icons/undercover.webp"
            : "/System/Icons/securityos.webp"
        }
        width={22}
      />
    </div>
  );
};

export default StartButtonIcon;

import { DashboardScreen } from "../../src/screens/DashboardScreen";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";

export default function DashboardRoute() {
  const props = useLegacyScreenProps();

  return <DashboardScreen {...props} />;
}

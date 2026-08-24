import { ProfileScreen } from "../../src/screens/ProfileScreen";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";

export default function ProfileRoute() {
  const props = useLegacyScreenProps();

  return <ProfileScreen {...props} />;
}

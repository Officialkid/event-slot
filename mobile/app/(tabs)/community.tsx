import { CommunityScreen } from "../../src/screens/CommunityScreen";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";

export default function CommunityRoute() {
  const props = useLegacyScreenProps();

  return <CommunityScreen {...props} />;
}

import { ForgotPasswordScreen } from "../../src/screens/ForgotPasswordScreen";
import { useNativeApp } from "../../src/providers/NativeAppProvider";

export default function ForgotPasswordRoute() {
  const { theme } = useNativeApp();

  return <ForgotPasswordScreen theme={theme} />;
}

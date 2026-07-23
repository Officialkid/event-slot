import { NativeAuthMode } from "./api/contracts";

export type AppSession = {
  displayName: string;
  email: string;
  role: string;
  plan: string;
  tokenBalance: number;
  authMode: NativeAuthMode;
  accessToken?: string;
};

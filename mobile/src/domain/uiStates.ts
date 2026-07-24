export type NativeUiStateTone = "neutral" | "loading" | "warning" | "error" | "success";

export type NativeUiStateKey =
  | "empty"
  | "loading"
  | "error"
  | "no-internet"
  | "slow-network"
  | "no-search-results"
  | "permission-denied"
  | "session-expired"
  | "form-validation"
  | "success";

export type NativeUiStatePattern = {
  key: NativeUiStateKey;
  title: string;
  message: string;
  actionLabel: string;
  tone: NativeUiStateTone;
  qaExpectation: string;
};

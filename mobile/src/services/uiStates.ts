import { NativeUiStatePattern } from "../domain/uiStates";

export const nativeUiStatePatterns: NativeUiStatePattern[] = [
  {
    key: "empty",
    title: "No items yet",
    message: "Show this when an organizer has no events, no exports, no notifications, or no saved records yet.",
    actionLabel: "Add first item",
    tone: "neutral",
    qaExpectation: "The screen should explain what is missing and offer one clear next step."
  },
  {
    key: "loading",
    title: "Loading",
    message: "Use soft skeleton cards or a spinner while live EventSlot data is being fetched.",
    actionLabel: "Please wait",
    tone: "loading",
    qaExpectation: "The app should never look frozen while dashboard, events, exports, or verification data loads."
  },
  {
    key: "error",
    title: "Something went wrong",
    message: "Use this for failed API calls, failed export preparation, or unexpected app errors.",
    actionLabel: "Try again",
    tone: "error",
    qaExpectation: "The user should see a retry path and a calm explanation without raw technical errors."
  },
  {
    key: "no-internet",
    title: "No internet connection",
    message: "Use this when the device cannot reach EventSlot or the network probe fails.",
    actionLabel: "Retry",
    tone: "warning",
    qaExpectation: "Offline/connection failures should be clear before testers blame their account or event."
  },
  {
    key: "slow-network",
    title: "Taking longer than usual",
    message: "Use this after a request passes the normal wait threshold but has not failed yet.",
    actionLabel: "Keep waiting",
    tone: "loading",
    qaExpectation: "Slow networks should show progress and avoid duplicate submissions."
  },
  {
    key: "no-search-results",
    title: "No results found",
    message: "Use this when event filters, attendee search, or verifier lookup returns nothing.",
    actionLabel: "Clear search",
    tone: "neutral",
    qaExpectation: "The user should know the search completed and what to try next."
  },
  {
    key: "permission-denied",
    title: "Permission needed",
    message: "Use this when camera, notifications, or file access is blocked by device settings.",
    actionLabel: "Open settings",
    tone: "warning",
    qaExpectation: "The app should explain why the permission matters and how to recover."
  },
  {
    key: "session-expired",
    title: "Session expired",
    message: "Use this when refresh tokens fail or the server requires a fresh sign-in.",
    actionLabel: "Log in again",
    tone: "error",
    qaExpectation: "The user should be safely returned to sign-in with local session data cleaned up."
  },
  {
    key: "form-validation",
    title: "Check the highlighted fields",
    message: "Use this when required event, attendee, upload, consent, or login fields are incomplete.",
    actionLabel: "Fix fields",
    tone: "error",
    qaExpectation: "Each invalid field should say exactly what is missing or invalid."
  },
  {
    key: "success",
    title: "Saved successfully",
    message: "Use this after event drafts, settings, exports, sign-in, or verification actions complete.",
    actionLabel: "Continue",
    tone: "success",
    qaExpectation: "Successful actions should confirm what happened and guide the user forward."
  }
];

export function getNativeUiStatesReadinessMessage() {
  return `${nativeUiStatePatterns.length} reusable mobile state patterns are defined for empty, loading, error, network, permission, session, validation, and success flows.`;
}

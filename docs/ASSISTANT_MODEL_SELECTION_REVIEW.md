# Assistant Model Selection Architecture (Phase 8 Review-Only)

Status: HOLD (do not implement until explicit approval)
Date: 2026-05-15

## Scope
This document captures architecture planning only for assistant model selection.
No runtime behavior changes are implemented from this document.

## Current Architecture
- All users (text): Groq -> `llama-3.1-8b-instant`
- All users (images): Groq -> `llama-3.2-11b-vision-preview`

## Proposed Future Model Options
- EventSlot Auto (default)
  - Provider: Groq
  - Cost: Free
  - Quality: Good
  - Speed: Very fast
- Llama 3.1 70B
  - Provider: Groq
  - Cost: Free
  - Quality: Excellent
  - Speed: Medium
- Mixtral 8x7B
  - Provider: Groq
  - Cost: Free
  - Quality: Very good
  - Speed: Fast
- Gemma 2 9B
  - Provider: Groq
  - Cost: Free
  - Quality: Good
  - Speed: Fast
- Future: Hugging Face models
  - Provider: HF Inference
  - Cost: Free (unreliable)
  - Quality: Variable
  - Speed: Slow

## Candidate Implementation (Future, Not Active)
```ts
// Model selection stored in user preferences
model UserPreferences {
  id              String @id @default(cuid())
  userId          String @unique
  assistantModel  String @default("llama-3.1-8b-instant")
}

// Dropdown in assistant header
const AVAILABLE_MODELS = [
  { id: "llama-3.1-8b-instant", label: "Auto (Recommended)", badge: "Fast" },
  { id: "llama-3.1-70b-versatile", label: "Llama 3.1 70B", badge: "Smart" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", badge: "Balanced" },
]
```

## Decisions Required Before Build
1. Should model selection be available to all users or only logged-in users?
2. Should some models cost extra credits?
3. Hugging Face models remain blocked for production until reliability is verified.

## Verification Checklist (Phase 8 Impact)
When Phase 8 is approved and implemented, verify:
- Selected model is persisted per user preference.
- Default model remains available as fallback.
- Unsupported/retired model IDs gracefully revert to default.
- Model selection changes do not break image routing behavior.
- Quota and credit policy still applies consistently across model choices.

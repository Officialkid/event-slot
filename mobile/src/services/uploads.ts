import { nativeConfig } from "../config";
import { NativeAttachmentDraft, NativeAttachmentKind, NativeAttachmentRequirement } from "../domain/attachments";

export const defaultAttachmentRequirement: NativeAttachmentRequirement = {
  enabled: false,
  label: "Attach a file",
  caption: "Allow attendees to upload an image or document with their registration.",
  acceptedKind: "any",
  maxFileSizeMb: 10,
  required: false
};

export function getUploadReadinessMessage(): string {
  if (!nativeConfig.uploadsEnabled) {
    return "Native uploads are disabled until file picker, bucket upload permissions, and mobile error handling are reviewed.";
  }

  return "Native uploads are enabled for integration testing.";
}

export function isAttachmentKindAllowed(kind: NativeAttachmentKind, mimeType: string): boolean {
  if (kind === "any") {
    return true;
  }

  if (kind === "image") {
    return mimeType.startsWith("image/");
  }

  return !mimeType.startsWith("image/");
}

export function validateAttachmentDraft(
  attachment: NativeAttachmentDraft,
  requirement: NativeAttachmentRequirement
): string | null {
  if (!requirement.enabled) {
    return "This event is not requesting file uploads.";
  }

  if (!isAttachmentKindAllowed(requirement.acceptedKind, attachment.mimeType)) {
    return `This upload does not match the accepted file type: ${requirement.acceptedKind}.`;
  }

  const maxBytes = requirement.maxFileSizeMb * 1024 * 1024;

  if (attachment.sizeBytes > maxBytes) {
    return `File is larger than ${requirement.maxFileSizeMb} MB.`;
  }

  return null;
}

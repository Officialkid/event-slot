import * as DocumentPicker from "expo-document-picker";
import { nativeConfig } from "../config";
import {
  NativeAttachmentDraft,
  NativeAttachmentKind,
  NativeAttachmentPickResult,
  NativeAttachmentRequirement
} from "../domain/attachments";

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
    return "Native file picker support is wired, but bucket upload writes remain disabled until permissions, size limits, and Android error handling are reviewed.";
  }

  return "Native uploads are enabled for integration testing.";
}

export async function pickNativeAttachment(requirement: NativeAttachmentRequirement): Promise<NativeAttachmentPickResult> {
  if (!requirement.enabled) {
    return {
      status: "error",
      message: "This event is not requesting file uploads."
    };
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: getDocumentPickerTypes(requirement.acceptedKind)
    });

    if (result.canceled) {
      return {
        status: "cancelled",
        message: "No file selected."
      };
    }

    const asset = result.assets[0];
    if (!asset) {
      return {
        status: "error",
        message: "No file details were returned by the picker."
      };
    }

    const attachment: NativeAttachmentDraft = {
      id: `${Date.now()}-${asset.name}`,
      localUri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
      name: asset.name,
      sizeBytes: asset.size ?? 0,
      source: "document-picker"
    };

    return {
      status: "picked",
      attachment: {
        ...attachment,
        validationError: validateAttachmentDraft(attachment, requirement)
      }
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to open the native file picker."
    };
  }
}

export function getDocumentPickerTypes(kind: NativeAttachmentKind): string | string[] {
  if (kind === "image") {
    return "image/*";
  }

  if (kind === "document") {
    return [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain"
    ];
  }

  return "*/*";
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

export function prepareNativeAttachmentUpload(attachment: NativeAttachmentDraft, requirement: NativeAttachmentRequirement): {
  ready: boolean;
  message: string;
} {
  const validationError = validateAttachmentDraft(attachment, requirement);
  if (validationError) {
    return {
      ready: false,
      message: validationError
    };
  }

  if (!nativeConfig.uploadsEnabled) {
    return {
      ready: false,
      message: "File selection is ready, but bucket upload is still disabled for native release safety."
    };
  }

  return {
    ready: true,
    message: "Attachment is ready for bucket upload."
  };
}

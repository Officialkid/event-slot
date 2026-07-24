import * as DocumentPicker from "expo-document-picker";
import { nativeConfig } from "../config";
import { apiBaseUrl } from "../api/client";
import {
  NativeAttachmentDraft,
  NativeAttachmentKind,
  NativeAttachmentPickResult,
  NativeAttachmentRequirement,
  NativeAttachmentUploadResult,
  NativeAttachmentUploadTarget
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
    return "Native file picker, validation, and multipart upload path are wired, but bucket writes remain disabled until live event targets and Android error handling are reviewed.";
  }

  return "Native uploads are enabled for integration testing when a live event slug and file-question id are available.";
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

  if (!Number.isFinite(requirement.maxFileSizeMb) || requirement.maxFileSizeMb <= 0) {
    return "Set a valid maximum file size before testing uploads.";
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
      message: "File selection is ready, but bucket upload writes are still disabled for native release safety."
    };
  }

  return {
    ready: true,
    message: "Attachment is valid and ready for a live EventSlot upload target."
  };
}

export async function uploadNativeAttachment(
  attachment: NativeAttachmentDraft,
  requirement: NativeAttachmentRequirement,
  target?: NativeAttachmentUploadTarget
): Promise<NativeAttachmentUploadResult> {
  const preparation = prepareNativeAttachmentUpload(attachment, requirement);
  if (!preparation.ready) {
    return {
      status: "blocked",
      message: preparation.message
    };
  }

  if (!target?.eventSlug || !target.questionId) {
    return {
      status: "blocked",
      message: "This file is valid, but native upload needs a live event slug and file-question id before writing to the bucket."
    };
  }

  if (!attachment.localUri) {
    return {
      status: "error",
      message: "This selected file is missing a local URI."
    };
  }

  const formData = new FormData();
  formData.append("eventSlug", target.eventSlug);
  formData.append("questionId", target.questionId);
  formData.append("file", {
    uri: attachment.localUri,
    name: attachment.name,
    type: attachment.mimeType
  } as unknown as Blob);

  try {
    const response = await fetch(`${apiBaseUrl}/api/register/upload`, {
      method: "POST",
      body: formData
    });

    const payload = await response.json().catch(() => null) as {
      error?: string;
      file?: { url?: string };
    } | null;

    if (!response.ok) {
      return {
        status: "error",
        message: payload?.error ?? `Native upload failed with ${response.status}.`
      };
    }

    const uploadedUrl = payload?.file?.url;
    if (!uploadedUrl) {
      return {
        status: "error",
        message: "Native upload completed but no file URL was returned."
      };
    }

    return {
      status: "uploaded",
      uploadedUrl,
      message: "Attachment uploaded to EventSlot storage."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Native upload failed before reaching EventSlot."
    };
  }
}

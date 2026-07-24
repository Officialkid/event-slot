export type NativeAttachmentKind = "image" | "document" | "any";

export type NativeAttachmentRequirement = {
  enabled: boolean;
  label: string;
  caption: string;
  acceptedKind: NativeAttachmentKind;
  maxFileSizeMb: number;
  required: boolean;
};

export type NativeAttachmentDraft = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  localUri?: string;
  uploadedUrl?: string;
  source?: "document-picker" | "camera-roll" | "demo";
  validationError?: string | null;
};

export type NativeAttachmentPickResult =
  | {
      status: "picked";
      attachment: NativeAttachmentDraft;
    }
  | {
      status: "cancelled";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

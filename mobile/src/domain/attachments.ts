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
};

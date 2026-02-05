/** Discriminated union for multimodal content parts. */

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  /** Base64-encoded image data. */
  data: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

export interface FileContent {
  type: "file";
  /** Base64-encoded file data. */
  data: string;
  mimeType: string;
  fileName: string;
}

export type ContentPart = TextContent | ImageContent | FileContent;

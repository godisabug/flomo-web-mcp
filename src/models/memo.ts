export interface MemoFile {
  id?: string;
  type?: string;
  name?: string;
  size?: number;
  url?: string;
  thumbnailUrl?: string;
  path?: string;
  mimeType?: string;
}

export interface Memo {
  slug: string;
  content: string;
  html?: string;
  files?: MemoFile[];
  tags: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

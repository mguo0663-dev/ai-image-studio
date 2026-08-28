export interface HistoryRecord {
  id: string;
  prompt: string;
  style: string;
  aspect_ratio: string;
  image_count: number;
  image_urls: string[] | null;
  reference_image_keys: string[] | null;
  model?: string;
  status: string;
  created_at: string;
}

export interface RefImage {
  id: string;
  url: string;
  key: string;
  name: string;
  uploadedAt?: number;
}

export interface GalleryItem {
  id: string;
  type: 'generated' | 'reference' | 'generating';
  url?: string;
  prompt?: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
  createdAt: number;
  recordId?: string;
  refImageId?: string;
  refImageUrls?: string[];
  progress?: number;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  style: string;
  model: string;
  aspectRatio: string;
  refImageUrls: string[];
  timestamp: number;
}

'use client';

import React, { useState, useCallback } from 'react';
import { Download, Maximize2, X, Share2 } from 'lucide-react';

interface ImagePreviewProps {
  images: string[];
  onDownload: (url: string, filename: string) => void;
  aspectRatio?: string;
}

// Map aspect ratio to CSS aspect-ratio value
const ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1': '1/1',
  '16:9': '16/9',
  '9:16': '9/16',
  '4:3': '4/3',
  '3:4': '3/4',
  '3:2': '3/2',
  '2:3': '2/3',
};

// Get grid layout based on aspect ratio and image count
function getGridLayout(aspectRatio: string, imageCount: number): string {
  const ratio = aspectRatio.replace('custom', '1:1');
  
  // For tall images (9:16, 3:4, 2:3), use 2 columns for multiple images
  if (['9:16', '3:4', '2:3'].includes(ratio) && imageCount > 1) {
    return 'grid-cols-2';
  }
  
  // For wide images (16:9, 4:3, 3:2) with 2+ images, use 2 columns
  if (['16:9', '4:3', '3:2'].includes(ratio) && imageCount >= 2) {
    return 'grid-cols-2';
  }
  
  // Default: single image takes full width, multiple images in 2 columns
  return imageCount === 1 ? 'grid-cols-1' : 'grid-cols-2';
}

export function ImagePreview({ images, onDownload, aspectRatio = '1:1' }: ImagePreviewProps) {
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  const handleShare = useCallback(async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AI Generated Image',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // User cancelled or not supported
    }
  }, []);

  if (images.length === 0) return null;

  const cssAspectRatio = ASPECT_RATIO_MAP[aspectRatio] || ASPECT_RATIO_MAP['1:1'];
  const gridCols = getGridLayout(aspectRatio, images.length);

  return (
    <>
      <div className={`grid ${gridCols} gap-3 mt-4`}>
        {images.map((url, index) => (
          <div
            key={url}
            className="animate-fade-in-scale group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/40"
          >
            <img
              src={url}
              alt={`Generated ${index + 1}`}
              className="w-full object-cover"
              style={{ aspectRatio: cssAspectRatio }}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomedIndex(index)}
                  className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="放大查看"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDownload(url, `ai-image-${index + 1}.png`)}
                  className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleShare(url)}
                  className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="分享"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Zoom Modal */}
      {zoomedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedIndex(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[zoomedIndex]}
              alt={`Zoomed ${zoomedIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onDownload(images[zoomedIndex], `ai-image-${zoomedIndex + 1}.png`)
                }
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900/90 text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
              <button
                type="button"
                onClick={() => handleShare(images[zoomedIndex])}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900/90 text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
              >
                <Share2 className="w-4 h-4" />
                分享
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

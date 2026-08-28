'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Download, Maximize2, X, Image as ImageIcon, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { type GalleryItem } from './types';

const ASPECT_RATIO_DIMS: Record<string, [number, number]> = {
  '1:1': [1, 1],
  '16:9': [16, 9],
  '9:16': [9, 16],
  '4:3': [4, 3],
  '3:4': [3, 4],
  '3:2': [3, 2],
  '2:3': [2, 3],
};

const CARD_HEIGHT = 220;
const MIN_CARD_WIDTH = 100;

function getCardWidth(aspectRatio?: string): number {
  if (!aspectRatio || aspectRatio === 'custom') return CARD_HEIGHT;
  const dims = ASPECT_RATIO_DIMS[aspectRatio];
  if (!dims) return CARD_HEIGHT;
  return Math.max(MIN_CARD_WIDTH, Math.round(CARD_HEIGHT * (dims[0] / dims[1])));
}

interface GalleryGridProps {
  items: GalleryItem[];
  onDownload: (url: string, filename: string) => void;
  onRemoveRef?: (id: string) => void;
  onRemoveItem?: (item: GalleryItem) => void;
  onReuseFromGallery?: (item: GalleryItem) => void;
}

export function GalleryGrid({ items, onDownload, onRemoveRef, onRemoveItem, onReuseFromGallery }: GalleryGridProps) {
  const [zoomedItem, setZoomedItem] = useState<GalleryItem | null>(null);

  // Only items with an actual URL can be zoomed/navigated
  const zoomableItems = items.filter((it) => it.url);
  const currentIndex = zoomedItem
    ? zoomableItems.findIndex((it) => it.id === zoomedItem.id)
    : -1;

  const goToIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= zoomableItems.length) return;
      setZoomedItem(zoomableItems[idx]);
    },
    [zoomableItems],
  );

  // Keyboard navigation: ← → to switch, Esc to close
  useEffect(() => {
    if (!zoomedItem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setZoomedItem(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = currentIndex <= 0 ? zoomableItems.length - 1 : currentIndex - 1;
        goToIndex(prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = currentIndex >= zoomableItems.length - 1 ? 0 : currentIndex + 1;
        goToIndex(next);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [zoomedItem, currentIndex, zoomableItems.length, goToIndex]);


  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-zinc-600 select-none">
        <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-sm text-zinc-500">开始创作，图像将在此展示</p>
        <p className="text-xs text-zinc-700 mt-1">输入描述并点击生成</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 content-start p-4">
        {items.map((item) => {
          const cardWidth = getCardWidth(item.aspectRatio);

          if (item.type === 'generating') {
            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl gallery-card-enter"
                style={{ width: cardWidth, height: CARD_HEIGHT }}
              >
                {/* Cloud-like organic motion */}
                <div className="gen-cloud-wrap">
                  <div className="gen-cloud gen-cloud-1" />
                  <div className="gen-cloud gen-cloud-2" />
                  <div className="gen-cloud gen-cloud-3" />
                  <div className="gen-cloud gen-cloud-4" />
                </div>
                <div className="absolute top-2 left-2 text-white/90 text-xs font-medium drop-shadow-sm">
                  生成中｜{Math.floor(((item as { progress?: number }).progress ?? 0) * 100)}%
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                if (item.url) {
                  e.dataTransfer.setData('gallery-item-url', item.url);
                  e.dataTransfer.setData('gallery-item-id', item.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }
              }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800/60 hover:border-zinc-600 cursor-pointer transition-all duration-150 hover:scale-[1.01] gallery-card-enter"
              style={{ width: cardWidth, height: CARD_HEIGHT }}
              onClick={() => setZoomedItem(item)}
            >
              <img
                src={item.url}
                alt={item.prompt || 'Reference image'}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  {item.prompt && (
                    <p className="text-[11px] text-zinc-300 line-clamp-2 mb-1.5 leading-snug">
                      {item.prompt}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedItem(item);
                      }}
                      className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-white transition-colors"
                      title="放大查看"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.url) onDownload(item.url, 'ai-image.png');
                      }}
                      className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-white transition-colors"
                      title="下载"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {item.type === 'generated' && onReuseFromGallery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReuseFromGallery(item);
                        }}
                        className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-white transition-colors"
                        title="复用参数"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Delete button - top right, visible on hover */}
              {onRemoveItem && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-900/80 text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  title="移除"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Zoom Modal */}
      {zoomedItem && zoomedItem.url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedItem(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedItem(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Left arrow (switch to previous, wrap around) */}
          {zoomableItems.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const prev = currentIndex <= 0 ? zoomableItems.length - 1 : currentIndex - 1;
                goToIndex(prev);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors z-10"
              title="上一张 (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Right arrow (switch to next, wrap around) */}
          {zoomableItems.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = currentIndex >= zoomableItems.length - 1 ? 0 : currentIndex + 1;
                goToIndex(next);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors z-10"
              title="下一张 (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedItem.url}
              alt={zoomedItem.prompt || 'Image'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (zoomedItem.url) onDownload(zoomedItem.url, 'ai-image.png');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-zinc-900/90 text-zinc-200 hover:text-white transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
              {zoomedItem.type === 'generated' && onReuseFromGallery && (
                <button
                  type="button"
                  onClick={() => {
                    onReuseFromGallery(zoomedItem);
                    setZoomedItem(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-zinc-900/90 text-zinc-200 hover:text-white transition-colors text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  复用参数
                </button>
              )}
            </div>
          </div>

          {/* Position indicator (bottom-right, shows current / total) */}
          {zoomableItems.length > 1 && currentIndex >= 0 && (
            <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-md bg-zinc-900/80 text-zinc-300 text-xs select-none">
              {currentIndex + 1} / {zoomableItems.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

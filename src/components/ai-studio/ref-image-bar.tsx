'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, GripVertical, Upload } from 'lucide-react';
import { type RefImage } from './types';

interface RefImageBarProps {
  images: RefImage[];
  onImagesChange: (images: RefImage[]) => void;
  onUpload: () => void;
}

export function RefImageBar({ images, onImagesChange, onUpload }: RefImageBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const sourceIndex = dragItem.current;
      if (sourceIndex === null || sourceIndex === targetIndex) {
        setDragIndex(null);
        setDropIndex(null);
        return;
      }
      const newImages = [...images];
      const [removed] = newImages.splice(sourceIndex, 1);
      newImages.splice(targetIndex, 0, removed);
      onImagesChange(newImages);
      setDragIndex(null);
      setDropIndex(null);
      dragItem.current = null;
    },
    [images, onImagesChange]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
    dragItem.current = null;
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      onImagesChange(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange]
  );

  const getImageLabel = (index: number) => {
    const labels = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return labels[index] || String(index + 1);
  };

  const handleDragStartToText = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('ref-image-index', String(index));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onUpload}
          className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          添加参考图
        </button>
        <span className="text-xs text-zinc-600">拖动参考图到文本框可插入为引用</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      {images.map((img, index) => (
        <div
          key={img.id}
          draggable
          onDragStart={(e) => {
            handleDragStart(index);
            handleDragStartToText(e, index);
          }}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`
            relative group flex-shrink-0 w-16 h-16 rounded-md border overflow-hidden cursor-grab active:cursor-grabbing
            transition-all duration-150
            ${dragIndex === index ? 'opacity-40 scale-95' : ''}
            ${dropIndex === index && dragIndex !== index ? 'border-blue-500 border-2' : 'border-zinc-700'}
            hover:border-zinc-500
          `}
        >
          <div className="absolute top-0 left-0 z-10 px-1 py-0.5 text-[10px] bg-zinc-900/80 text-zinc-300 rounded-br">
            <GripVertical className="w-3 h-3 inline -mt-0.5" />
            图{getImageLabel(index)}
          </div>
          <img
            src={img.url}
            alt={img.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
          <button
            type="button"
            onClick={() => handleRemove(img.id)}
            className="absolute top-0 right-0 z-10 p-0.5 bg-zinc-900/80 text-zinc-400 hover:text-red-400 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onUpload}
        className="flex-shrink-0 w-16 h-16 rounded-md border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
      >
        <Upload className="w-5 h-5" />
      </button>
    </div>
  );
}

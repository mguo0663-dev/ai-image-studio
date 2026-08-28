'use client';

import React, { useCallback } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { type HistoryRecord } from './types';

interface HistoryPanelProps {
  records: HistoryRecord[];
  loading: boolean;
  onDelete: (id: string) => void;
  onReuse: (record: HistoryRecord) => void;
}

const STYLE_LABELS: Record<string, string> = {
  realistic: '写实',
  anime: '动漫',
  oil_painting: '油画',
  watercolor: '水彩',
  pixel_art: '像素',
  cyberpunk: '赛博朋克',
  minimalist: '极简',
  sketch: '素描',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

export function HistoryPanel({ records, loading, onDelete, onReuse }: HistoryPanelProps) {
  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDelete(id);
    },
    [onDelete]
  );

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
        加载中...
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm">
        <Clock className="w-6 h-6 mb-2" />
        暂无历史记录
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {records.map((record) => (
        <div
          key={record.id}
          onClick={() => onReuse(record)}
          className="group relative p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700 cursor-pointer transition-all duration-150"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-zinc-300 line-clamp-2 flex-1 leading-snug">
              {record.prompt}
            </p>
            <button
              type="button"
              onClick={(e) => handleDelete(e, record.id)}
              className="flex-shrink-0 p-1 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {STYLE_LABELS[record.style] || record.style}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {record.aspect_ratio}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {record.image_count}张
            </span>
            <span className="text-[10px] text-zinc-600 ml-auto">{formatTime(record.created_at)}</span>
          </div>
          {record.image_urls && record.image_urls.length > 0 && (
            <div className="flex gap-1 mt-2">
              {record.image_urls.slice(0, 3).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-10 h-10 rounded object-cover border border-zinc-800"
                />
              ))}
              {record.image_urls.length > 3 && (
                <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs">
                  +{record.image_urls.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

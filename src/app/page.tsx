'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ArrowUp, Menu, X, Loader2, Upload, GripVertical, Plus } from 'lucide-react';
import { PromptInput, type StyleTag, STYLE_COLORS } from '@/components/ai-studio/prompt-input';
import { ParamSettings } from '@/components/ai-studio/param-settings';
import { GalleryGrid } from '@/components/ai-studio/gallery-grid';
import { HistoryPanel } from '@/components/ai-studio/history-panel';
import { type HistoryRecord, type RefImage, type GalleryItem, type GeneratedImage } from '@/components/ai-studio/types';
import { loadGeneratedImages, saveGeneratedImages } from '@/lib/image-cache';

// Style label mapping
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

// Points system
const DAILY_POINTS = 240;
const POINTS_STORAGE_KEY = 'ai-studio-points';

interface PointsData {
  date: string; // YYYY-MM-DD
  remaining: number;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadPoints(): number {
  if (typeof window === 'undefined') return DAILY_POINTS;
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEY);
    if (!raw) return DAILY_POINTS;
    const data: PointsData = JSON.parse(raw);
    if (data.date !== getTodayStr()) {
      // New day, reset
      const fresh: PointsData = { date: getTodayStr(), remaining: DAILY_POINTS };
      localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(fresh));
      return DAILY_POINTS;
    }
    return data.remaining;
  } catch {
    return DAILY_POINTS;
  }
}

function savePoints(remaining: number) {
  if (typeof window === 'undefined') return;
  const data: PointsData = { date: getTodayStr(), remaining };
  localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(data));
}

interface ActiveGenerationJob {
  id: string;
  imageCount: number;
  aspectRatio: string;
  progress: number;
  createdAt: number;
}

export default function HomePage() {
  // Prompt
  const [prompt, setPrompt] = useState('');
  // Points
  const [points, setPoints] = useState(DAILY_POINTS);
  // Ref images (input box)
  // Ref images (input box)
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  // All reference images ever uploaded (persists in gallery even if removed from input)
  const [galleryRefImages, setGalleryRefImages] = useState<RefImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Measured height (px) of the input card content, 0 = unmeasured.
  // Used to animate the outer wrapper's height whenever the contents reflow.
  const inputCardRef = useRef<HTMLDivElement>(null);
  const [inputCardHeight, setInputCardHeight] = useState<number>(0);

  // Parameters
  const [style, setStyle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('none');
  const [customWidth, setCustomWidth] = useState('2560');
  const [customHeight, setCustomHeight] = useState('2560');
  const [imageCount, setImageCount] = useState(1);
  const [model, setModel] = useState('gpt-image-2');

  // Style Tags
  const [styleTags, setStyleTags] = useState<StyleTag[]>([]);
  const [draggedTagIndex, setDraggedTagIndex] = useState<number | null>(null);

  // Generation — parallel jobs; each job has independent progress/cards
  const [activeJobs, setActiveJobs] = useState<ActiveGenerationJob[]>([]);
  const jobTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const [genButtonHovered, setGenButtonHovered] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const errorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnyGenerating = activeJobs.length > 0;

  // History
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history?limit=50');
      const data = await res.json();
      if (data.records) {
        setHistory(data.records);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Load points from localStorage on mount
  useEffect(() => {
    setPoints(loadPoints());
  }, []);

  // Load generated images from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    loadGeneratedImages()
      .then((saved) => {
        if (mounted && Array.isArray(saved) && saved.length > 0) {
          setGeneratedImages(saved);
        }
      })
      .catch((err) => console.error('Failed to load cached images:', err));
    return () => { mounted = false; };
  }, []);

  // Save generated images to IndexedDB (large-capacity; keeps all images across refreshes)
  useEffect(() => {
    // Debounced save — no need to write on every single state change
    const timer = setTimeout(() => {
      saveGeneratedImages(generatedImages).catch((err) =>
        console.warn('Failed to persist images:', err),
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [generatedImages]);

  // Upload files as reference images
  const uploadFilesAsRef = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.key && data.url) {
          const newRef: RefImage = {
            id: data.key,
            url: data.url,
            key: data.key,
            name: file.name,
            uploadedAt: Date.now(),
          };
          setRefImages((prev) => [...prev, newRef]);
          setGalleryRefImages((prev) => [...prev, newRef]);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  }, []);

  // Upload reference image
  const handleUploadRefImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      await uploadFilesAsRef(files);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadFilesAsRef]
  );

  // Handle style change - add to tags if not empty
  const handleStyleChange = useCallback(
    (newStyle: string) => {
      setStyle(newStyle);
      if (newStyle && !styleTags.find((t) => t.value === newStyle)) {
        const label = STYLE_LABELS[newStyle] || newStyle;
        const color = STYLE_COLORS[newStyle] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
        setStyleTags((prev) => [...prev, { value: newStyle, label, color }]);
      }
    },
    [styleTags]
  );

  // Handle aspect ratio change - append "比例X:Y" to prompt text
  const handleAspectRatioChange = useCallback((ratio: string) => {
    setAspectRatio(ratio);
    // 'none' = default state, no ratio text appended to prompt
    if (ratio === 'none') {
      setPrompt((prev) => prev.replace(/\s*比例(?:\d+:\d+|自定义)\s*$/g, '').trimEnd());
      return;
    }
    const ratioLabel = ratio === 'custom' ? '比例自定义' : `比例${ratio}`;
    setPrompt((prev) => {
      // Remove existing ratio marker at end of text
      const cleaned = prev.replace(/\s*比例(?:\d+:\d+|自定义)\s*$/g, '').trimEnd();
      return cleaned ? `${cleaned} ${ratioLabel}` : ratioLabel;
    });
  }, []);

  // Handle style tags change (from drag/drop or delete)
  const handleStyleTagsChange = useCallback((newTags: StyleTag[]) => {
    setStyleTags(newTags);
    setStyle(newTags.length > 0 ? newTags[0].value : '');
  }, []);

  // Remove style tag by index
  const removeStyleTag = useCallback(
    (index: number) => {
      const newTags = styleTags.filter((_, i) => i !== index);
      handleStyleTagsChange(newTags);
    },
    [styleTags, handleStyleTagsChange]
  );

  // Style tag drag handlers
  const handleStyleTagDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedTagIndex(index);
    e.dataTransfer.setData('style-tag-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleStyleTagDragEnd = useCallback(() => {
    setDraggedTagIndex(null);
  }, []);

  const handleStyleTagDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const sourceIndex = parseInt(e.dataTransfer.getData('style-tag-index'), 10);
      if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

      const newTags = [...styleTags];
      const [removed] = newTags.splice(sourceIndex, 1);
      newTags.splice(targetIndex, 0, removed);
      handleStyleTagsChange(newTags);
    },
    [styleTags, handleStyleTagsChange]
  );

  const handleStyleTagDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Remove ref image from input box only (gallery keeps it)
  const handleRemoveRefImage = useCallback((id: string) => {
    setRefImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  // Remove ref image from gallery (also removes from input)
  const handleRemoveRefImageFromGallery = useCallback((id: string) => {
    setGalleryRefImages((prev) => prev.filter((img) => img.id !== id));
    setRefImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  // Handle removing any gallery item
  const handleRemoveGalleryItem = useCallback(
    (item: GalleryItem) => {
      if (item.type === 'reference' && item.refImageId) {
        handleRemoveRefImageFromGallery(item.refImageId);
      } else if (item.type === 'generated') {
        // Remove from generated images
        if (item.url) {
          setGeneratedImages((prev) => prev.filter((g) => g.url !== item.url));
        }
        // Also remove from history if it has a recordId
        if (item.recordId) {
          fetch(`/api/history/${item.recordId}`, { method: 'DELETE' }).catch(() => {});
          setHistory((prev) => prev.filter((r) => r.id !== item.recordId));
        }
      }
    },
    [handleRemoveRefImageFromGallery]
  );

  // Generate
  // Unmount: stop all active progress timers to avoid leaks
  useEffect(() => {
    const timers = jobTimersRef.current;
    return () => {
      timers.forEach((t) => clearInterval(t));
      timers.clear();
      if (errorDismissTimerRef.current) clearTimeout(errorDismissTimerRef.current);
    };
  }, []);

  // Animate the input card's height whenever its internal content changes
  // (newline, ref images appearing, chips added, custom-size panel opened, etc.).
  // Technique: wrap in an outer box that has explicit `height` + transition,
  // use ResizeObserver to track the actual content size.
  // The resize callback writes new heights on the NEXT animation frame so the
  // browser has a "before" value to interpolate from (otherwise React batches
  // everything into one render and the transition has no start point).
  useEffect(() => {
    const el = inputCardRef.current;
    if (!el) return;

    let pendingRaf = 0;
    let lastSeen = 0;

    const applyHeight = () => {
      const h = el.offsetHeight;
      if (h > 0 && h !== lastSeen) {
        lastSeen = h;
        setInputCardHeight(h);
      }
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        // Defer — ensures the previous (pre-change) render was actually painted
        // before we commit the new target height, enabling the transition.
        cancelAnimationFrame(pendingRaf);
        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = requestAnimationFrame(applyHeight);
        });
      });
      ro.observe(el);
    }

    // First measurement (mount) — no transition possible, so apply directly.
    const initial = el.offsetHeight;
    if (initial > 0) {
      lastSeen = initial;
      setInputCardHeight(initial);
    }

    return () => {
      ro?.disconnect();
      cancelAnimationFrame(pendingRaf);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    // Capture snapshot of inputs at click-time so later edits don't change the
    // job that's already been dispatched.
    const jobPrompt = prompt.trim();
    const jobImageCount = imageCount;
    const jobAspectRatio = aspectRatio === 'none' ? '1:1' : aspectRatio;
    const jobCustomWidth = customWidth;
    const jobCustomHeight = customHeight;
    const jobModel = model;
    const jobRefImages = refImages.map((img) => img.url);
    const jobStyleValues = styleTags.map((t) => t.value);

    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const createdAt = Date.now();

    // ---- Register job (cards appear immediately) ----
    setActiveJobs((prev) => [
      {
        id: jobId,
        imageCount: jobImageCount,
        aspectRatio: jobAspectRatio,
        progress: 0,
        createdAt,
      },
      ...prev,
    ]);

    // Per-job progress timer (runs independently of other jobs)
    const timerId = setInterval(() => {
      setActiveJobs((prev) =>
        prev.map((j) => {
          if (j.id !== jobId) return j;
          if (j.progress >= 0.95) return j;
          return { ...j, progress: j.progress + (1 - j.progress) * 0.03 };
        }),
      );
    }, 200);
    jobTimersRef.current.set(jobId, timerId);

    try {
      const finalResolution =
        jobAspectRatio === 'custom'
          ? `${jobCustomWidth}x${jobCustomHeight}`
          : '1024';

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: jobPrompt,
          style: jobStyleValues.length > 0 ? jobStyleValues.join(',') : undefined,
          resolution: finalResolution,
          detailLevel: 'high',
          aspectRatio: jobAspectRatio,
          imageCount: jobImageCount,
          model: jobModel,
          referenceImageUrls: jobRefImages.length > 0 ? jobRefImages : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '生成失败');
      }

      if (data.imageUrls) {
        const genTimestamp = Date.now();
        const newImages: GeneratedImage[] = data.imageUrls.map((url: string) => ({
          url,
          prompt: jobPrompt,
          style: jobStyleValues.join(','),
          model: jobModel,
          aspectRatio: jobAspectRatio,
          refImageUrls: jobRefImages,
          timestamp: genTimestamp,
        }));
        setGeneratedImages((prev) => [...newImages, ...prev]);
        // Deduct points once per task (after success)
        const generatedCount = data.imageUrls.length;
        setPoints((currentPoints) => {
          const newPoints = Math.max(0, currentPoints - generatedCount);
          savePoints(newPoints);
          return newPoints;
        });
      }

      // Refresh history after each successful task
      fetchHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '网络错误';
      setError(msg);
      // Auto-dismiss after 5s
      if (errorDismissTimerRef.current) clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = setTimeout(() => setError(null), 5000);
    } finally {
      // Stop & remove this specific job's timer + remove job card
      const existingTimer = jobTimersRef.current.get(jobId);
      if (existingTimer) {
        clearInterval(existingTimer);
        jobTimersRef.current.delete(jobId);
      }
      setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
    }
  }, [prompt, imageCount, aspectRatio, customWidth, customHeight, model, refImages, styleTags, fetchHistory]);

  // Download
  const handleDownload = useCallback(async (url: string, filename: string) => {
    try {
      // data URL 直接在客户端下载
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        return;
      }
      const res = await fetch(`/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (data.downloadUrl) {
        const response = await fetch(data.downloadUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, []);

  // Reuse history record
  const handleReuse = useCallback((record: HistoryRecord) => {
    setPrompt(record.prompt);
    setAspectRatio(record.aspect_ratio || 'none');
    setImageCount(record.image_count || 1);
    setModel(record.model || 'gpt-image-2');
    // Restore style tags
    if (record.style) {
      const styleValues = record.style.split(',');
      const newTags: StyleTag[] = styleValues.map((v) => ({
        value: v,
        label: STYLE_LABELS[v] || v,
        color: STYLE_COLORS[v] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
      }));
      setStyleTags(newTags);
      setStyle(styleValues[0] || '');
    } else {
      setStyleTags([]);
      setStyle('');
    }
    // Restore reference images to input box only (galleryRefImages is never touched by reuse)
    if (record.reference_image_keys && record.reference_image_keys.length > 0) {
      const restoredRefImages: RefImage[] = record.reference_image_keys.map((url, index) => ({
        id: `ref-${record.id}-${index}`,
        url,
        key: url,
        name: `参考图${index + 1}`,
        uploadedAt: Date.now() - index * 1000,
      }));
      setRefImages(restoredRefImages);
    }
    // galleryRefImages is NEVER modified by reuse — it only changes via explicit user actions (upload, gallery delete, drag)
    setShowHistory(false);
  }, []);

  // Reuse from gallery
  const handleReuseFromGallery = useCallback(
    (item: GalleryItem) => {
      if (item.recordId) {
        const record = history.find((r) => r.id === item.recordId);
        if (record) {
          handleReuse(record);
          return;
        }
      }
      // Fallback: restore from the GalleryItem (session images)
      setPrompt(item.prompt || '');
      setAspectRatio(item.aspectRatio || 'none');
      if (item.model) setModel(item.model);
      if (item.style) {
        const styleValues = item.style.split(',').filter((s) => s);
        const newTags: StyleTag[] = styleValues.map((v) => ({
          value: v,
          label: STYLE_LABELS[v] || v,
          color: STYLE_COLORS[v] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
        }));
        setStyleTags(newTags);
        setStyle(styleValues[0] || '');
      } else {
        setStyleTags([]);
        setStyle('');
      }
      // Restore reference images from stored refImageUrls
      if (item.refImageUrls && item.refImageUrls.length > 0) {
        const restoredRefImages: RefImage[] = item.refImageUrls.map((url, index) => ({
          id: `reuse-ref-${Date.now()}-${index}`,
          url,
          key: url,
          name: `参考图${index + 1}`,
          uploadedAt: Date.now() - index * 1000,
        }));
        setRefImages(restoredRefImages);
      }
    },
    [history, handleReuse]
  );

  // Delete history
  const handleDeleteHistory = useCallback(async (id: string) => {
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, []);

  // Compute gallery items
  const galleryItems = useMemo(() => {
    const items: GalleryItem[] = [];
    const seenUrls = new Set<string>();
    const now = Date.now();

    // Generating placeholders — one card per requested image per ACTIVE job.
    // Newer jobs sort first via `createdAt + 1e6`.
    activeJobs.forEach((job) => {
      for (let i = 0; i < job.imageCount; i++) {
        items.push({
          id: `gen-loading-${job.id}-${i}`,
          type: 'generating',
          aspectRatio: job.aspectRatio,
          progress: job.progress,
          // Sort so new jobs always sit at the very top of the gallery
          createdAt: job.createdAt + 1_000_000 - i,
        });
      }
    });

    // Add current session generated images (newest first)
    generatedImages.forEach((img, i) => {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        items.push({
          id: `gen-current-${i}-${img.timestamp}`,
          type: 'generated',
          url: img.url,
          prompt: img.prompt,
          aspectRatio: img.aspectRatio,
          style: img.style,
          model: img.model,
          refImageUrls: img.refImageUrls,
          createdAt: img.timestamp - i,
        });
      }
    });

    // Add reference images (use galleryRefImages which persists even when removed from input)
    galleryRefImages.forEach((img) => {
      seenUrls.add(img.url);
      items.push({
        id: `ref-${img.id}`,
        type: 'reference',
        url: img.url,
        refImageId: img.id,
        aspectRatio: '1:1',
        createdAt: img.uploadedAt || now - 10000,
      });
    });

    // Add history records (generated images + reference images from history)
    history.forEach((record) => {
      // Add reference images from history as gallery items
      if (record.reference_image_keys && record.reference_image_keys.length > 0) {
        record.reference_image_keys.forEach((url, i) => {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            items.push({
              id: `hist-ref-${record.id}-${i}`,
              type: 'reference',
              url,
              aspectRatio: '1:1',
              createdAt: new Date(record.created_at).getTime() - (record.reference_image_keys!.length - i) * 100,
            });
          }
        });
      }
      // Add generated images from history
      if (record.image_urls) {
        record.image_urls.forEach((url, i) => {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            items.push({
              id: `hist-${record.id}-${i}`,
              type: 'generated',
              url,
              prompt: record.prompt,
              aspectRatio: record.aspect_ratio,
              style: record.style,
              model: record.model,
              createdAt: new Date(record.created_at).getTime() + i,
              recordId: record.id,
            });
          }
        });
      }
    });

    // Sort newest first
    items.sort((a, b) => b.createdAt - a.createdAt);

    return items;
  }, [history, galleryRefImages, activeJobs, generatedImages]);

  // Ref image drag start (for dropping into textarea)
  const handleRefDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('ref-image-index', String(index));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Ref image drag reorder
  const handleRefDragOver = useCallback((e: React.DragEvent, _targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRefDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      // Check for gallery item drop (add as new ref image)
      const galleryUrl = e.dataTransfer.getData('gallery-item-url');
      if (galleryUrl) {
        const newRef: RefImage = {
          id: `gallery-ref-${Date.now()}`,
          url: galleryUrl,
          key: galleryUrl,
          name: '画廊图片',
          uploadedAt: Date.now(),
        };
        if (targetIndex === -1) {
          // Dropped on "+" button - add as new
          setRefImages((prev) => [...prev, newRef]);
        } else {
          // Dropped on existing ref image - replace it
          setRefImages((prev) => {
            const updated = [...prev];
            updated[targetIndex] = newRef;
            return updated;
          });
        }
        // Don't add to galleryRefImages - the image is already in the gallery
        return;
      }

      // Check for ref image reorder
      const sourceIndexStr = e.dataTransfer.getData('ref-image-index');
      const sourceIndex = parseInt(sourceIndexStr, 10);
      if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

      setRefImages((prev) => {
        const newImages = [...prev];
        const [removed] = newImages.splice(sourceIndex, 1);
        newImages.splice(targetIndex, 0, removed);
        return newImages;
      });
    },
    []
  );

  // Handle gallery item dropped on the "+" add ref button
  const handleAddRefDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const galleryUrl = e.dataTransfer.getData('gallery-item-url');
      if (galleryUrl) {
        const newRef: RefImage = {
          id: `gallery-ref-${Date.now()}`,
          url: galleryUrl,
          key: galleryUrl,
          name: '画廊图片',
          uploadedAt: Date.now(),
        };
        setRefImages((prev) => [...prev, newRef]);
        // Don't add to galleryRefImages - the image is already in the gallery
      }
    },
    []
  );

  // Track drag-over state for ref image area
  const [refDragOverIndex, setRefDragOverIndex] = useState<number | null>(null);
  // Track full-page drag-over state
  const [pageDragOver, setPageDragOver] = useState(false);

  // Full-page drag-and-drop handlers
  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setPageDragOver(true);
    }
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    if (e.relatedTarget === null) {
      setPageDragOver(false);
    }
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setPageDragOver(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        uploadFilesAsRef(files);
      }
    }
  }, [uploadFilesAsRef]);

  return (
    <div
      className="flex flex-col h-screen bg-[#09090b] overflow-hidden relative"
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {/* Full-page drag overlay */}
      {pageDragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-dashed border-blue-400/50 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-12 h-12 text-blue-400" />
            <p className="text-blue-300 text-lg font-medium">拖放图片以上传为参考图</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* History sidebar overlay */}
      {showHistory && (
        <div className="fixed inset-0 z-40 flex">
          <aside
            className="w-72 bg-[#0c0c0e] border-r border-zinc-800/60 h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
              <h2 className="text-sm font-medium text-zinc-300">历史记录</h2>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <HistoryPanel
                records={history}
                loading={historyLoading}
                onDelete={handleDeleteHistory}
                onReuse={handleReuse}
              />
            </div>
          </aside>
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/40 flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center">
        </div>
        <div className="ml-auto">
        </div>
      </header>

      {/* Gallery area */}
      <div className="flex-1 overflow-y-auto pb-4 mb-12">
        <GalleryGrid
          items={galleryItems}
          onDownload={handleDownload}
          onRemoveRef={handleRemoveRefImageFromGallery}
          onRemoveItem={handleRemoveGalleryItem}
          onReuseFromGallery={handleReuseFromGallery}
        />
      </div>

      {/* Error notification - positioned above the card */}
      {error && (
        <div className="px-6 pb-2">
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm max-w-3xl mx-auto">
            <span className="flex-1 text-center">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Gradient fade + input card */}
      <div className="flex-shrink-0 relative">
        <div className="px-4 pb-4 pt-1">
          {/* Animated height wrapper */}
          <div
            className="max-w-3xl mx-auto overflow-hidden rounded-2xl"
            style={{
              height: inputCardHeight > 0 ? inputCardHeight : 'auto',
              transition:
                'height 320ms cubic-bezier(0.45, 0, 0.55, 1), box-shadow 200ms ease',
              willChange: 'height',
            }}
          >
            <div
              ref={inputCardRef}
              className="w-full rounded-2xl bg-[#18181b]/95 backdrop-blur-xl"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { handleAddRefDrop(e); setRefDragOverIndex(null); }}
            >
          {/* Top area: ref images + style tags */}
          <div
            className={`grid transition-[grid-template-rows,opacity] ease-out origin-top overflow-hidden ${
              refImages.length > 0 || styleTags.length > 0
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            }`}
            style={{ transitionDuration: (refImages.length > 0 || styleTags.length > 0) ? '300ms' : '200ms' }}
          >
            <div className="min-h-0">
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 flex-wrap">
              {/* Reference image thumbnails - draggable for reorder */}
              {refImages.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(e) => handleRefDragStart(e, index)}
                  onDragOver={(e) => { e.preventDefault(); setRefDragOverIndex(index); }}
                  onDragLeave={() => setRefDragOverIndex(null)}
                  onDrop={(e) => { handleRefDrop(e, index); setRefDragOverIndex(null); }}
                  className={`
                    relative group w-9 h-9 rounded-lg border overflow-hidden flex-shrink-0 cursor-grab active:cursor-grabbing transition-all duration-150
                    ${refDragOverIndex === index
                      ? 'border-blue-400/70 ring-1 ring-blue-400/30 scale-110'
                      : 'border-zinc-700/60 hover:border-zinc-500'}
                  `}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRefImage(img.id)}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-900/90 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                  <div className="absolute bottom-0 left-0 px-0.5 text-[7px] bg-zinc-900/80 text-zinc-400 leading-tight rounded-tr">
                    图{['一','二','三','四','五','六','七','八','九','十'][index] || index + 1}
                  </div>
                </div>
              ))}

              {/* Add ref image button - also a drop target for gallery items */}
              <button
                type="button"
                onClick={handleUploadRefImage}
                onDragOver={(e) => { e.preventDefault(); setRefDragOverIndex(-1); }}
                onDragLeave={() => setRefDragOverIndex(null)}
                onDrop={(e) => { handleAddRefDrop(e); setRefDragOverIndex(null); }}
                className={`
                  w-9 h-9 rounded-lg border border-dashed flex items-center justify-center transition-colors flex-shrink-0
                  ${refDragOverIndex === -1
                    ? 'border-blue-400/70 text-blue-400 bg-blue-500/10'
                    : 'border-zinc-700/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'}
                `}
                title="添加参考图（也可拖入画廊图片）"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Separator */}
              {refImages.length > 0 && styleTags.length > 0 && (
                <div className="w-px h-5 bg-zinc-700/50 mx-1" />
              )}

              {/* Style tags */}
              {styleTags.map((tag, index) => (
                <div
                  key={tag.value}
                  draggable
                  onDragStart={(e) => handleStyleTagDragStart(e, index)}
                  onDragEnd={handleStyleTagDragEnd}
                  onDragOver={handleStyleTagDragOver}
                  onDrop={(e) => handleStyleTagDrop(e, index)}
                  className={`
                    group flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border cursor-move text-[11px]
                    transition-all duration-150
                    ${tag.color}
                    ${draggedTagIndex === index ? 'opacity-50 scale-95' : 'opacity-100'}
                  `}
                >
                  <GripVertical className="w-2 h-2 opacity-40" />
                  <span className="font-medium">{tag.label}</span>
                  <button
                    type="button"
                    onClick={() => removeStyleTag(index)}
                    className="ml-0.5 p-0.5 rounded hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              </div>
            </div>
          </div>

          {/* Middle: Text input + Upload + Generate button */}
          <div className="flex items-end gap-2 px-4 py-2">
            {/* Upload button (shown when no ref images yet) */}
            {refImages.length === 0 && (
              <button
                type="button"
                onClick={handleUploadRefImage}
                onDragOver={(e) => { e.preventDefault(); setRefDragOverIndex(-1); }}
                onDragLeave={() => setRefDragOverIndex(null)}
                onDrop={(e) => { handleAddRefDrop(e); setRefDragOverIndex(null); }}
                className={`
                  flex-shrink-0 w-[42px] h-[56px] rounded-lg border flex items-center justify-center transition-colors
                  ${refDragOverIndex === -1
                    ? 'border-blue-400/70 text-blue-400 bg-blue-500/10'
                    : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/60'}
                `}
                title="添加参考图（也可拖入画廊图片）"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            {/* Text input */}
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              refImageCount={refImages.length}
              onGenerate={handleGenerate}
              isGenerating={isAnyGenerating}
            />

            {/* Generate button - circular arrow up. Can be clicked repeatedly — 
                each click dispatches a new generation task without waiting. */}
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={!prompt.trim()}
              onMouseEnter={() => setGenButtonHovered(true)}
              onMouseLeave={() => setGenButtonHovered(false)}
              className={`
                flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.45,0,0.55,1)]
                ${
                  !prompt.trim()
                    ? 'bg-zinc-800 cursor-not-allowed'
                    : isAnyGenerating
                      ? 'bg-white cursor-pointer active:scale-95'
                      : 'bg-zinc-100 hover:bg-white active:scale-95'
                }
              `}
            >
              <img
                src="https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fshengcheng-02-02-02.svg&nonce=752ec068-3b5a-45a5-9d31-d5a2f1b674a9&project_id=7645346065935351808&sign=1a271f7564338027ea34c9c918f56404dbaebe9b574764b293945387369e0230"
                alt="generate"
                className={`w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.45,0,0.55,1)] ${
                  !prompt.trim()
                    ? 'brightness-0 invert opacity-40'
                    : isAnyGenerating
                      ? 'brightness-0'
                      : genButtonHovered
                        ? 'brightness-0 opacity-90 scale-110'
                        : 'brightness-0 opacity-90'
                }`}
              />
            </button>
          </div>

          {/* Bottom: Parameter settings row */}
          <div className="px-4 pb-3 pt-0.5">
            <ParamSettings
              aspectRatio={aspectRatio}
              onAspectRatioChange={handleAspectRatioChange}
              customWidth={customWidth}
              onCustomWidthChange={setCustomWidth}
              customHeight={customHeight}
              onCustomHeightChange={setCustomHeight}
              imageCount={imageCount}
              onImageCountChange={setImageCount}
              onAppendTransparent={() => {
                setPrompt((prev) => {
                  if (prev.includes('无背景、transparent')) {
                    return prev.replace(/\s*无背景、transparent/g, '').trimEnd();
                  }
                  const base = prev.replace(/\s+$/, '');
                  return base ? `${base} 无背景、transparent` : '无背景、transparent';
                });
              }}
              transparentActive={prompt.includes('无背景、transparent')}
            />
          </div>
            </div>  {/* close inner card (bg backdrop-blur) */}
          </div>    {/* close animated-height wrapper */}
        </div>      {/* close px-4 pb-4 pt-1 */}
      </div>        {/* close flex-shrink-0 relative */}
    </div>
  );
}

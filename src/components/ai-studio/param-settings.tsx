'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Monitor } from 'lucide-react';

// Aspect ratio icon: renders a rectangle matching the selected ratio
function AspectRatioIcon({ ratio }: { ratio: string }) {
  const size = 14; // total svg viewBox size
  const padding = 1;
  const parseRatio = (r: string): [number, number] => {
    if (r === 'custom') return [4, 3];
    const parts = r.split(':').map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return [parts[0], parts[1]];
    return [1, 1];
  };
  const [rw, rh] = parseRatio(ratio);
  const maxDim = size - padding * 2;
  const scale = maxDim / Math.max(rw, rh);
  const w = rw * scale;
  const h = rh * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-zinc-500">
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.2" rx="1" />
    </svg>
  );
}

// Transparent-PNG icon (no-background), rendered inline so currentColor can match
// the surrounding icon colors (text-zinc-500, same as aspect-ratio icon)
function TransparentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M844.3904 355.9936c6.656-3.0208 14.336 4.4544 29.696 19.3536a352.6144 352.6144 0 0 1 4.096 502.4256 353.28 353.28 0 0 1-502.5792-2.9696c-15.0016-15.36-22.528-23.04-19.456-29.696 3.0208-6.656 14.6944-5.9392 38.144-4.608 7.68 0.512 15.4112 0.7168 23.1424 0.7168h5.5808c17.3056-0.3072 25.9584-0.4608 31.744 1.0752 5.7344 1.536 13.824 6.4 30.0544 16.0768a272.2816 272.2816 0 0 0 332.4416-41.3696 271.872 271.872 0 0 0 42.1888-329.5232c-10.6496-18.1248-15.872-27.1872-17.408-32.7168-1.536-5.4784-1.4848-15.36-1.4848-35.0208v-2.304c0-7.7824-0.256-15.616-0.7168-23.3472-1.3824-23.3472-2.048-35.0208 4.608-38.0928zM405.3504 42.6496A363.1104 363.1104 0 0 1 768 405.3504 362.6496 362.6496 0 1 1 405.3504 42.6496z m-39.3216 498.2784l-2.1504 0.1024c-3.584 0.9216-4.7104 5.2224-7.0656 13.824a273.408 273.408 0 0 0-9.5232 72.192c0 13.056 0.8704 26.112 2.7648 38.9632 0.9728 6.656 1.4848 10.0352 3.9936 12.544 2.5088 2.56 5.888 2.9696 12.5952 3.9424a276.48 276.48 0 0 0 38.7072 2.56c24.3712 0.1536 48.6912-3.072 72.192-9.472 8.6016-2.304 12.9024-3.4816 13.824-7.0144 1.024-3.584-2.2528-6.8608-8.8064-13.3632l-105.3184-105.3696c-6.5536-6.5024-9.7792-9.728-13.3632-8.8064z m270.1312-293.4272a279.552 279.552 0 0 0-510.5664 157.8496 279.3472 279.3472 0 0 0 120.7296 231.936c6.7584 4.6592 10.0864 6.9632 13.1584 5.9392a6.656 6.656 0 0 0 1.7408-0.9216c2.56-1.8944 2.56-6.144 2.56-14.592a363.1104 363.1104 0 0 1 362.7008-362.7008c8.4992 0 12.8 0 14.6944-2.6112a6.656 6.656 0 0 0 0.8704-1.5872c1.0752-3.072-1.2288-6.5024-5.888-13.312zM458.4448 407.1424c-4.1984-0.1536-7.424 2.6112-13.824 8.192a281.0368 281.0368 0 0 0-29.3376 29.2352c-5.5296 6.4512-8.2944 9.728-8.192 13.824 0.2048 4.1984 3.3792 7.424 9.728 13.7216l146.944 146.944c4.1984 4.096 6.8608 6.144 10.24 6.2464 4.1984 0.1024 7.424-2.6624 13.824-8.192 10.496-9.0112 20.2752-18.8416 29.2864-29.2864 5.5296-6.4512 8.3456-9.6256 8.192-13.824-0.1536-4.1984-3.328-7.3728-9.6768-13.7216L489.344 413.952c-4.1984-4.0448-6.912-6.0928-10.24-6.1952z m168.6528-59.8528a273.408 273.408 0 0 0-72.192 9.5232c-8.6016 2.3552-12.9024 3.5328-13.8752 7.0656-0.9728 3.584 2.304 6.8096 8.8576 13.312l105.3184 105.3696c6.5024 6.5536 9.7792 9.7792 13.312 8.8576 3.584-1.024 4.7616-5.2736 7.1168-13.8752a273.408 273.408 0 0 0 9.472-72.192c0-13.0048-0.8704-25.9072-2.6112-38.7584-0.9728-6.656-1.4336-10.0352-3.9424-12.544-2.5088-2.56-5.8368-3.072-12.544-3.9936a261.2224 261.2224 0 0 0-38.912-2.7648z" />
    </svg>
  );
}

const ASPECT_RATIOS = [
  { value: 'none', label: '比例' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '21:9', label: '21:9' },
  { value: '9:21', label: '9:21' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: 'custom', label: '自定义' },
];

function DropdownButton({
  label,
  icon: Icon,
  items,
  value,
  onChange,
  width,
  renderItemIcon,
}: {
  label: string;
  icon?: React.FC<{ className?: string }>;
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  width?: string;
  renderItemIcon?: (itemValue: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [menuMeasured, setMenuMeasured] = useState(false);

  useEffect(() => {
    if (open) {
      const handler = (e: MouseEvent) => {
        // Menu is rendered via portal to document.body, so we must check
        // both the anchor (ref) and the portal menu (menuRef) to avoid
        // closing the menu when the user clicks a menu item.
        const inAnchor = ref.current && ref.current.contains(e.target as Node);
        const inMenu = menuRef.current && menuRef.current.contains(e.target as Node);
        if (!inAnchor && !inMenu) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [open]);

  // When closing, reset measurement state so next open re-measures
  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      setMenuMeasured(false);
    }
  }, [open]);

  // Compute menu position from the anchor — rendered via portal so it can
  // escape any ancestor overflow:hidden / transform stacking contexts.
  // Two-phase layout:
  //   Phase 1 (menuMeasured=false): render menu invisibly at (0,0) to measure its height.
  //   Phase 2 (menuMeasured=true):  move menu to correct position above the button.
  useEffect(() => {
    if (!open || !ref.current) return;

    // Phase 1: measure actual menu height via an invisible pass.
    if (!menuMeasured) {
      // Wait a tick so the invisible menu is in the DOM.
      const raf = requestAnimationFrame(() => {
        if (menuRef.current) {
          setMenuMeasured(true);
        }
      });
      return () => cancelAnimationFrame(raf);
    }

    // Phase 2: compute actual position with measured dimensions.
    const update = () => {
      if (!ref.current || !menuRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      const menuHeight = menuRef.current.offsetHeight;
      const spaceAbove = rect.top;
      const gap = 8;
      let top: number;
      if (spaceAbove >= menuHeight + gap + 8) {
        // Enough space above: place menu ABOVE the button
        top = rect.top - menuHeight - gap;
      } else {
        // Not enough space above: fallback to below the button
        top = rect.bottom + gap;
      }
      setMenuPos({
        top,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, menuMeasured]);

  const selected = items.find((i) => i.value === value);
  const displayLabel = selected?.label || label;

  // Always render the menu via portal when open.
  // When menuMeasured is false, the menu is rendered invisibly at the viewport
  // origin so we can measure its true height before positioning.
  const menuEl = (
    <div
      ref={menuRef}
      style={
        menuMeasured && menuPos
          ? {
              position: 'fixed',
              top: Math.max(8, menuPos.top),
              left: menuPos.left,
              minWidth: Math.max(menuPos.width, 120),
              zIndex: 9999,
              visibility: 'visible',
              pointerEvents: 'auto',
            }
          : {
              position: 'fixed',
              top: 0,
              left: 0,
              minWidth: 120,
              zIndex: 9999,
              visibility: 'hidden',
              pointerEvents: 'none',
            }
      }
      className="py-1 bg-zinc-800 border border-zinc-700/60 rounded-lg shadow-2xl animate-[card-enter_120ms_ease-out]"
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => { onChange(item.value); setOpen(false); }}
          className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5 ${
            value === item.value
              ? 'text-zinc-100 bg-zinc-700/50'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/30'
          }`}
        >
          {renderItemIcon && renderItemIcon(item.value)}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="relative" style={width ? { width } : undefined}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 text-xs hover:bg-zinc-700/60 hover:border-zinc-600 transition-colors whitespace-nowrap"
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-zinc-500" />}
        <span>{displayLabel}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' && open
        ? createPortal(menuEl, document.body)
        : null}
    </div>
  );
}

interface ParamSettingsProps {
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  customWidth: string;
  onCustomWidthChange: (w: string) => void;
  customHeight: string;
  onCustomHeightChange: (h: string) => void;
  imageCount: number;
  onImageCountChange: (count: number) => void;
  /** Called when the transparent-PNG shortcut button is clicked */
  onAppendTransparent?: () => void;
  /** When true, the icon uses the bright/active color to indicate phrase is present */
  transparentActive?: boolean;
}

export function ParamSettings({
  aspectRatio,
  onAspectRatioChange,
  customWidth,
  onCustomWidthChange,
  customHeight,
  onCustomHeightChange,
  imageCount,
  onImageCountChange,
  onAppendTransparent,
  transparentActive = false,
}: ParamSettingsProps) {
  const showCustom = aspectRatio === 'custom';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Aspect ratio dropdown */}
        <DropdownButton
          label="比例"
          icon={() => <AspectRatioIcon ratio={aspectRatio} />}
          items={ASPECT_RATIOS}
          value={aspectRatio}
          onChange={onAspectRatioChange}
          renderItemIcon={(v) => <AspectRatioIcon ratio={v} />}
        />

        {/* Transparent PNG shortcut button */}
        <button
          type="button"
          onClick={() => onAppendTransparent?.()}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
            transparentActive
              ? 'bg-zinc-700/60 border-zinc-600'
              : 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/60 hover:border-zinc-600'
          }`}
          title="transparent 透明背景"
        >
          <TransparentIcon
            className={`w-4 h-4 transition-colors ${
              transparentActive ? 'text-white/85' : 'text-zinc-500'
            }`}
          />
        </button>

        {/* Image count toggle */}
        <div className="flex items-center rounded-lg border border-zinc-700/50 overflow-hidden">
          {[1, 2, 4].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onImageCountChange(count)}
              className={`px-2 py-1.5 text-xs transition-colors ${
                imageCount === count
                  ? 'bg-zinc-600/50 text-zinc-100'
                  : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {count}张
            </button>
          ))}
        </div>
      </div>

      {/* Custom size inputs — on a separate row so 0fr grid never leaves
          a horizontal blank gap between buttons above. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] ease-out overflow-hidden origin-top ${
          showCustom ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        style={{ transitionDuration: showCustom ? '260ms' : '160ms' }}
      >
        <div className="min-h-0">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={customWidth}
              onChange={(e) => onCustomWidthChange(e.target.value)}
              min={256}
              max={4096}
              placeholder="宽"
              className="w-14 px-1.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <span className="text-zinc-600 text-xs">×</span>
            <input
              type="number"
              value={customHeight}
              onChange={(e) => onCustomHeightChange(e.target.value)}
              min={256}
              max={4096}
              placeholder="高"
              className="w-14 px-1.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

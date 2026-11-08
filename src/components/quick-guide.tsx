'use client';

import { ChevronDown, Lightbulb } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { QuickGuide as Guide } from '@/modules/alerts/guide-content';

const EVENT = 'ewars:quick-guide';
/** Dự phòng khi trình duyệt chặn localStorage. */
const memory = new Map<string, string>();

/** Khóa đang ở lần xem đầu tiên trong phiên tải trang này: vẫn mở dù đã ghi nhớ "đóng" cho lần sau. */
const firstViews = new Set<string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Trình duyệt chặn lưu trữ — thẻ vẫn mở/đóng theo bộ nhớ trong phiên.
  }
  memory.set(key, value);
}

/** Mở ở lần xem đầu, từ lần sau mặc định thu gọn; người dùng bấm mở/đóng thì nhớ theo ý họ. */
function isOpen(key: string): boolean {
  const value = read(key);
  if (value === null) {
    firstViews.add(key);
    store(key, 'closed');
    return true;
  }
  return value === 'open' || firstViews.has(key);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Thẻ "Lần đầu dùng?" thu gọn được. Trạng thái đóng/mở nhớ trên trình duyệt (tiện ích riêng của
 * người xem — lỗi lưu trữ thì vẫn hiện bình thường). Server vẽ thu gọn để trang không nhảy với
 * người đã xem; lần xem đầu tự mở.
 */
export function QuickGuide({ guide, storageKey }: { guide: Guide; storageKey: string }) {
  const open = useSyncExternalStore(
    subscribe,
    () => isOpen(storageKey),
    () => false,
  );
  const toggle = (next: boolean) => {
    firstViews.delete(storageKey);
    store(storageKey, next ? 'open' : 'closed');
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      className="rounded-xl border border-primary/30 bg-primary-soft"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium">
        <span className="flex items-center gap-2">
          <Lightbulb aria-hidden className="size-4 text-primary" />
          {guide.title}
        </span>
        <span className="flex items-center gap-1 text-xs font-normal text-primary">
          {open ? 'Ẩn' : 'Xem'}
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform group-data-[state=open]:rotate-180"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol
          className={`grid gap-3 px-4 pb-4 sm:grid-cols-2 ${guide.steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
        >
          {guide.steps.map((s, i) => (
            <li key={s.title} className="rounded-lg bg-background/80 p-3 text-sm">
              <p className="font-medium">
                <span className="mr-1 text-primary tabular-nums">{i + 1}.</span>
                {s.title}
              </p>
              <p className="mt-1 text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

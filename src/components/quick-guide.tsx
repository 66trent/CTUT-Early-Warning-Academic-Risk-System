'use client';

import { ChevronDown, Lightbulb } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { QuickGuide as Guide } from '@/modules/alerts/guide-content';

const EVENT = 'ewars:quick-guide';
/** Dự phòng khi trình duyệt chặn localStorage. */
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
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
 * người xem — lỗi lưu trữ thì vẫn hiện bình thường). Mặc định mở cho lần đầu.
 */
export function QuickGuide({ guide, storageKey }: { guide: Guide; storageKey: string }) {
  const open = useSyncExternalStore(
    subscribe,
    () => read(storageKey) !== 'closed',
    () => true,
  );
  const toggle = (next: boolean) => {
    try {
      window.localStorage.setItem(storageKey, next ? 'open' : 'closed');
    } catch {
      // Trình duyệt chặn lưu trữ — thẻ vẫn mở/đóng theo sự kiện bên dưới trong phiên.
    }
    memory.set(storageKey, next ? 'open' : 'closed');
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
        <ol className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
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

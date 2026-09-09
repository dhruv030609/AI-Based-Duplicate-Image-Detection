import React from "react";
import { X, Command, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "← / →", desc: "Navigate previous or next duplicate group" },
    { key: "1 – 9", desc: "Instantly choose keeper candidate in group" },
    { key: "Space", desc: "Toggle comparison mode or wipe curtain" },
    { key: "D", desc: "Dismiss active duplicate group" },
    { key: "Escape", desc: "Close any modal or preview" },
    { key: "?", desc: "Open this keyboard shortcuts help dialog" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#e4e8ee] bg-white p-6 shadow-2xl sm:p-8 dark:border-[#2a374c] dark:bg-[#131923]">
        <div className="flex items-start justify-between border-b border-[#eef1f5] pb-4 dark:border-[#1e2736]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#1957d2] dark:bg-[#16274a] dark:text-[#5b8dfc]">
              <Keyboard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#172033] dark:text-white">
                Keyboard Shortcuts
              </h2>
              <p className="mt-0.5 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                Clean duplicates at lightning speed with hotkeys.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e7ef] text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:text-[#9fb0cf]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-xl border border-[#e8ecf2] bg-[#f8fafc] p-3 dark:border-[#222c3c] dark:bg-[#18202c]"
            >
              <span className="text-xs font-semibold text-[#172033] dark:text-[#e4e9f2]">
                {s.desc}
              </span>
              <kbd className="rounded-lg border border-[#cfd8e5] bg-white px-2.5 py-1 text-xs font-mono font-bold text-[#1957d2] shadow-sm dark:border-[#37445a] dark:bg-[#131923] dark:text-[#7ba6ff]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-[#1957d2] py-2.5 text-xs font-bold text-white transition hover:bg-[#1146b5]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

import { nextTick, onUnmounted, ref, watch } from "vue";
import type { Ref } from "vue";

export type UseConsoleOptions = {
  key?: string;
  maxLines?: number;
  batchSize?: number;
  scrollThreshold?: number;
  saveDebounceMs?: number;
  consoleRef?: Ref<HTMLElement | null>;
};

export function useConsole(options: UseConsoleOptions = {}) {
  const {
    key = "chroot_console_logs",
    maxLines = 250,
    batchSize = 50,
    scrollThreshold = 10,
    saveDebounceMs = 500,
  } = options;

  const consoleRef: Ref<HTMLElement | null> =
    options.consoleRef || ref<HTMLElement | null>(null);

  const buffer: Array<{ text: string; cls?: string }> = [];

  let flushFrame: number | null = null;
  let isFlushing = false;
  let scrollScheduled = false;
  let isUserScrolledUp = false;
  let lastScrollTop = 0;
  let saveTimer: number | null = null;

  function isAtBottom() {
    const el = consoleRef.value;
    if (!el) return true;
    const maxScroll = el.scrollHeight - el.clientHeight;
    return Math.abs(el.scrollTop - maxScroll) <= scrollThreshold;
  }

  function append(text: string, cls?: string) {
    if (!text && text !== "0") return;
    buffer.push({ text: String(text), cls });
    scheduleFlush();
  }

  function appendBatch(lines: string[] | string, cls?: string) {
    if (!Array.isArray(lines)) {
      append(lines as string, cls);
      return;
    }
    for (const l of lines) {
      if (l != null && String(l).trim()) {
        buffer.push({ text: String(l), cls });
      }
    }
    if (buffer.length > 0) scheduleFlush();
  }

  function clearConsole() {
    if (consoleRef.value) {
      consoleRef.value.textContent = "";
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore errors in restricted browsers / private mode
    }
  }

  async function copyLogs() {
    const el = consoleRef.value;
    if (!el) return false;
    const text = el.textContent ?? "";
    if (!text.trim()) {
      append("Console is empty - nothing to copy", "warn");
      return false;
    }

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(text);
        append("Console logs copied to clipboard");
        return true;
      } catch (err) {
        // fall through to fallback
      }
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      append("Console logs copied to clipboard");
      return true;
    } catch (err) {
      append("Failed to copy console logs - please copy manually", "warn");
      append(text);
      return false;
    }
  }

  function scheduleSave() {
    if (saveTimer != null) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      saveLogs();
      saveTimer = null;
    }, saveDebounceMs);
  }

  function saveLogs() {
    try {
      if (!consoleRef.value) return;
      const content = consoleRef.value.innerHTML;
      localStorage.setItem(key, content);
    } catch {
      // ignore localStorage quota and strict mode errors
    }
  }

  function loadLogs() {
    if (!consoleRef.value) return;
    const stored = (() => {
      try {
        return localStorage.getItem(key) || "";
      } catch {
        return "";
      }
    })();

    if (!stored) return;

    consoleRef.value.innerHTML = stored;

    const lines = consoleRef.value.querySelectorAll("div");
    if (lines.length > maxLines) {
      const toRemove = lines.length - maxLines;
      for (let i = 0; i < toRemove; i++) {
        const node = lines[i];
        if (node && node.parentNode) node.parentNode.removeChild(node);
      }
      saveLogs();
    }

    const finalLines = consoleRef.value.querySelectorAll("div");
    const hasScrollbar =
      consoleRef.value.scrollHeight > consoleRef.value.clientHeight;
    const shouldAnimate = finalLines.length < 15 && !hasScrollbar;

    if (shouldAnimate) {
      finalLines.forEach((line, i) => {
        if (!line.classList.contains("progress-indicator")) {
          line.classList.add("log-fade-in");
          (line as HTMLElement).style.animationDelay = `${i * 40}ms`;
        } else {
          line.classList.add("log-immediate");
        }
      });
    }

    setTimeout(() => {
      scrollInstant();
      isUserScrolledUp = false;
    }, 0);
  }

  function createLineNode(text: string, cls?: string, index = 0) {
    const node = document.createElement("div");
    node.textContent = text + "\n";
    if (cls) node.className = cls;

    const isProgressIndicator =
      cls === "progress-indicator" ||
      String(text).includes("⏳") ||
      String(text).includes("...") ||
      String(text).includes("⏳");

    if (isProgressIndicator) {
      node.classList.add("log-immediate");
    } else {
      node.classList.add("log-chunk-fade");
      node.style.animationDelay = `${index * 20}ms`;
    }
    return node;
  }

  function scheduleFlush() {
    if (flushFrame || isFlushing) return;
    flushFrame = window.setTimeout(() => {
      flushFrame = null;
      flush();
    }, 50);
  }

  function flush() {
    if (isFlushing) return;
    if (buffer.length === 0) return;

    const el = consoleRef.value;
    if (!el) {
      scheduleFlush();
      return;
    }

    isFlushing = true;
    const batch = buffer.splice(0, batchSize);
    const fragment = document.createDocumentFragment();

    const wasAtBottom = isAtBottom();

    const existingLines = Array.from(el.querySelectorAll("div"));
    const regularExisting = existingLines.filter(
      (n) => !n.classList.contains("progress-indicator"),
    );

    const totalAfterAdd = regularExisting.length + batch.length;
    if (totalAfterAdd > maxLines) {
      const toRemove = Math.min(
        totalAfterAdd - maxLines,
        regularExisting.length,
      );
      for (let i = 0; i < toRemove; i++) {
        const node = regularExisting[i];
        if (node && node.parentNode) node.parentNode.removeChild(node);
      }
    }

    batch.forEach((item, idx) => {
      const node = createLineNode(item.text, item.cls, idx);
      fragment.appendChild(node);
    });

    el.appendChild(fragment);

    if (wasAtBottom && !isUserScrolledUp) {
      scheduleScroll();
    }

    scheduleSave();

    isFlushing = false;

    if (buffer.length > 0) scheduleFlush();
  }

  function scheduleScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    window.setTimeout(() => {
      scrollScheduled = false;
      if (!consoleRef.value) return;
      consoleRef.value.scrollTop = consoleRef.value.scrollHeight;
    }, 0);
  }

  function scrollInstant() {
    if (!consoleRef.value) return;
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight;
  }

  function scrollToBottom(
    { behavior = "smooth", waitMs = 400 } = { behavior: "smooth", waitMs: 400 },
  ) {
    if (!consoleRef.value) return Promise.resolve();
    isUserScrolledUp = false;
    return new Promise<void>((resolve) => {
      consoleRef.value!.scrollTo({
        top: consoleRef.value!.scrollHeight,
        behavior: behavior as ScrollBehavior,
      });
      window.setTimeout(() => resolve(), waitMs);
    });
  }

  async function waitForFlush() {
    while (buffer.length > 0 || isFlushing) {
      await new Promise((r) => setTimeout(r, 40));
    }

    await nextTick();
  }

  function handleUserScroll() {
    window.setTimeout(() => {
      if (!consoleRef.value) return;
      if (!isAtBottom()) {
        isUserScrolledUp = true;
      } else {
        isUserScrolledUp = false;
      }
      lastScrollTop = consoleRef.value!.scrollTop;
    }, 150);
  }

  const stopWatchConsole = watch(
    consoleRef,
    (el, prevEl) => {
      try {
        if (prevEl) {
          (prevEl as HTMLElement).removeEventListener?.(
            "scroll",
            handleUserScroll,
          );
        }
      } catch {
        // ignore removal errors
      }

      if (el) {
        try {
          (el as HTMLElement).addEventListener("scroll", handleUserScroll, {
            passive: true,
          });
        } catch {
          // no-op on add listener errors
        }

        try {
          loadLogs();
        } catch {
          // ignore load errors
        }

        try {
          if (typeof scheduleFlush === "function") scheduleFlush();
        } catch {}
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    try {
      stopWatchConsole?.();
    } catch {
      // ignore
    }

    if (consoleRef.value) {
      try {
        consoleRef.value.removeEventListener("scroll", handleUserScroll);
      } catch {
        // ignore removal errors
      }
    }

    if (flushFrame) {
      window.clearTimeout(flushFrame);
      flushFrame = null;
    }
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
  });

  const LogBuffer = {
    consoleRef,
    append,
    appendBatch,
    clearConsole,
    copyLogs,
    saveLogs,
    loadLogs,
    scheduleFlush,
    flush,
    waitForFlush,
    scrollToBottom,
    scrollInstant,
    isAtBottom,
    handleUserScroll,
    getBuffer() {
      return buffer.slice();
    },
    isUserScrolledUpRef() {
      return isUserScrolledUp;
    },
  };

  return LogBuffer;
}

export default useConsole;

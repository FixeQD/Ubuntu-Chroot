export type ProgressType = "spinner" | "dots";

export interface ProgressHandle {
  element: HTMLElement;
  type: ProgressType;
  remove: () => void;
  update: (text: string) => void;
}

export function createProgressIndicator(
  text: string,
  type: ProgressType = "spinner",
  container?: HTMLElement | null,
): ProgressHandle {
  const CONTAINER_FALLBACK_ID = "console";
  const SPINNER_CHARS = ["|", "/", "-", "\\"];
  const SPINNER_INTERVAL_MS = 200;
  const DOTS_INTERVAL_MS = 400;
  const PREFIX = "⌛ ";

  // Defensive: resolve container
  const resolvedContainer =
    container ||
    (typeof document !== "undefined"
      ? document.getElementById(CONTAINER_FALLBACK_ID)
      : null) ||
    undefined;

  const el = document.createElement("div");
  el.className = "progress-indicator log-immediate";
  const baseText = String(text || "").trim();
  el.textContent = `${PREFIX}${baseText}`;

  if (resolvedContainer) {
    resolvedContainer.appendChild(el);
    try {
      resolvedContainer.scrollTo({
        top: resolvedContainer.scrollHeight,
        behavior: "smooth",
      });
    } catch {
      // ignore in environments where scrollTo throws
    }
  }

  let intervalId: number | null = null;
  let spinnerIndex = 0;
  let dotCount = 0;
  let visible = true;

  function updateSpinner() {
    if (!el.parentNode) {
      clearIntervalSafe();
      return;
    }
    spinnerIndex = (spinnerIndex + 1) % SPINNER_CHARS.length;
    el.textContent = `${PREFIX}${baseText} ${SPINNER_CHARS[spinnerIndex]}`;
  }

  function updateDots() {
    if (!el.parentNode) {
      clearIntervalSafe();
      return;
    }
    dotCount = (dotCount + 1) % 4; // 0..3
    const dots = ".".repeat(dotCount);
    el.textContent = dots
      ? `${PREFIX}${baseText} ${dots}`
      : `${PREFIX}${baseText}`;
  }

  function clearIntervalSafe() {
    if (intervalId !== null) {
      try {
        clearInterval(intervalId);
      } catch {
        // ignore
      }
      intervalId = null;
    }
  }

  if (type === "spinner") {
    intervalId = window.setInterval(
      updateSpinner,
      SPINNER_INTERVAL_MS,
    ) as unknown as number;
  } else {
    intervalId = window.setInterval(
      updateDots,
      DOTS_INTERVAL_MS,
    ) as unknown as number;
  }

  // Provide handles
  function remove() {
    clearIntervalSafe();
    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    } catch {
      // ignore removal errors
    }
  }

  function update(newText: string) {
    const t = String(newText || "").trim();
    const textToUse = `${PREFIX}${t}`;
    if (type === "spinner") {
      el.textContent = `${textToUse} ${SPINNER_CHARS[spinnerIndex % SPINNER_CHARS.length]}`;
    } else {
      const dots = ".".repeat(dotCount);
      el.textContent = dots ? `${textToUse} ${dots}` : textToUse;
    }
  }

  const handle: ProgressHandle = {
    element: el,
    type,
    remove,
    update,
  };

  return handle;
}

export function removeProgressIndicator(
  handleOrElement: ProgressHandle | HTMLElement | null | undefined,
) {
  if (!handleOrElement) return;
  if (typeof (handleOrElement as ProgressHandle).remove === "function") {
    try {
      (handleOrElement as ProgressHandle).remove();
      return;
    } catch {
      // fallthrough to element logic
    }
  }
  const el = (handleOrElement as HTMLElement) || null;
  if (!el) return;
  try {
    if (el.parentNode) el.parentNode.removeChild(el);
  } catch {
    // ignore
  }
}

export function updateProgressIndicator(
  handleOrElement: ProgressHandle | HTMLElement | null | undefined,
  text: string,
) {
  if (!handleOrElement) return;
  if (typeof (handleOrElement as ProgressHandle).update === "function") {
    try {
      (handleOrElement as ProgressHandle).update(text);
      return;
    } catch {
      // fallback
    }
  }

  const el = (handleOrElement as HTMLElement) || null;
  if (!el) return;
  const newText = String(text || "").trim();
  if (el.textContent) {
    const prefix = "⏳ ";
    const current = el.textContent || "";
    const afterPrefix = current.startsWith(prefix)
      ? current.substring(prefix.length)
      : current;
    // Keep trailing spinner/dots if present
    const trailingMatch = afterPrefix.match(/(\s[|\/\\\-.]+)$/);
    const trailing = trailingMatch ? trailingMatch[1] : "";
    el.textContent = `${prefix}${newText}${trailing}`;
  } else {
    el.textContent = `⏳ ${newText}`;
  }
}

const ProgressIndicator = Object.freeze({
  create: (text: string, type?: ProgressType, container?: HTMLElement | null) =>
    createProgressIndicator(
      text,
      (type as ProgressType) || "spinner",
      container,
    ),
  remove: removeProgressIndicator,
  update: updateProgressIndicator,
});

export default ProgressIndicator;

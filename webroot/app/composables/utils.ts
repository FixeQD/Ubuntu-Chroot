export const ButtonState = {
  setButton(
    btn: HTMLElement | null | undefined,
    enabled: boolean,
    visible = true,
    opacity: string | null = null,
  ) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.style.display = visible ? "" : "none";
    btn.style.opacity =
      opacity !== null ? (enabled ? "" : opacity) : enabled ? "" : "0.5";
    if (!enabled) {
      btn.classList.remove("btn-pressed", "btn-released");
      btn.style.transform = "";
      btn.style.boxShadow = "";
    }
  },

  setButtonPair(
    startBtn: HTMLElement | null | undefined,
    stopBtn: HTMLElement | null | undefined,
    isActive: boolean,
  ) {
    this.setButton(startBtn, !isActive, true, "0.5");
    this.setButton(stopBtn, isActive, true, "0.5");
  },

  setButtons(
    buttons: Array<{
      btn: HTMLElement | null | undefined;
      enabled: boolean;
      visible?: boolean;
      opacity?: string | null;
    }>,
  ) {
    buttons.forEach(({ btn, enabled, visible, opacity }) => {
      this.setButton(
        btn,
        enabled,
        visible !== undefined ? visible : true,
        opacity ?? null,
      );
    });
  },
};

export const PopupManager = {
  open(popup: HTMLElement | null | undefined) {
    if (!popup) return;
    popup.classList.add("active");
  },
  close(popup: HTMLElement | null | undefined) {
    if (!popup) return;
    popup.classList.remove("active");
  },
  setupClickOutside(
    popup: HTMLElement | null | undefined,
    closeFn: (() => void) | undefined,
  ) {
    if (!popup || !closeFn) return;
    const handler = (e: Event) => {
      if (e.target === popup) closeFn();
    };
    popup.addEventListener("click", handler);
    // return an unbind method if needed in future
    return () => popup.removeEventListener("click", handler);
  },
};

export function disableAllActions(
  startDisabled: { value: boolean },
  stopDisabled: { value: boolean },
  restartDisabled: { value: boolean },
  userSelectDisabled: { value: boolean },
  copyLoginDisabled: { value: boolean },
) {
  startDisabled.value = true;
  stopDisabled.value = true;
  restartDisabled.value = true;
  userSelectDisabled.value = true;
  copyLoginDisabled.value = true;

  // Disable console controls
  const clearConsoleBtn = document.getElementById(
    "clear-console",
  ) as HTMLButtonElement | null;
  const copyConsoleBtn = document.getElementById(
    "copy-console",
  ) as HTMLButtonElement | null;
  const refreshBtn = document.getElementById(
    "refresh-status",
  ) as HTMLButtonElement | null;

  if (clearConsoleBtn) clearConsoleBtn.disabled = true;
  if (copyConsoleBtn) copyConsoleBtn.disabled = true;
  if (refreshBtn) refreshBtn.disabled = true;
}

export function disableSettingsPopup(chrootExists = true) {
  const buttonsToDisable = [
    "post-exec-script",
    "save-script",
    "clear-script",
    "update-btn",
    "backup-btn",
    "restore-btn",
    "uninstall-btn",
    "trim-sparse-btn",
    "resize-sparse-btn",
  ];

  buttonsToDisable.forEach((id) => {
    const el = document.getElementById(id) as
      | HTMLButtonElement
      | HTMLInputElement
      | null;
    if (!el) return;
    el.setAttribute("disabled", "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.5";
  });
}

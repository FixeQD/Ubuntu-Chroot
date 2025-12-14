import { CommandResult } from "@/composables/useNativeCmd";

export type ResizeDeps = {
  // Persistence & UI
  Storage?: {
    get?: (k: string, d?: any) => any;
    set?: (k: string, v: any) => void;
    getJSON?: <T = any>(k: string, d?: any) => T | null;
    setJSON?: (k: string, v: any) => void;
  };
  appendConsole: (text: string, cls?: string) => void;

  // Dialog / helpers
  showConfirmDialog?: (
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string,
  ) => Promise<boolean>;
  showSizeSelectionDialog?: () => Promise<number | null>;

  // Commands and progress
  PATH_CHROOT_SH: string;
  CHROOT_DIR?: string;

  runCmdSync?: (cmd: string) => Promise<string>;
  runCmdAsync?: (
    cmd: string,
    onComplete?: (result: any) => void,
  ) => string | null;
  runCommandAsyncPromise?: (cmd: string, options?: { asRoot?: boolean; debug?: boolean; onOutput?: (line: string) => void }) => Promise<CommandResult>;

  // A convenience, higher-level helper used by the app to orchestrate long-running jobs
  executeCommandWithProgress?: (options: {
    cmd: string;
    progress: { progressLine: HTMLElement; progressInterval?: any } | null;
    onSuccess?: (result?: any) => void;
    onError?: (result?: any) => void;
    onComplete?: (result?: any) => void;
    useValue?: boolean;
    activeCommandIdRef?: { value: string | null } | undefined;
  }) => string | null;

  // UI helpers
  prepareActionExecution?: (
    headerText: string,
    progressText: string,
    progressType?: "spinner" | "dots",
  ) => Promise<{ progressLine: HTMLElement; interval?: any } | null>;
  ProgressIndicator?: { create: any; remove: any; update?: any };

  disableAllActions?: (disabled: boolean) => void;
  disableSettingsPopup?: (disabled: boolean, chrootExists?: boolean) => void;

  closeSettingsPopup?: () => void;

  updateStatus?: (status: string) => void;

  // Shared state & flags
  activeCommandId?: { value: string | null };
  rootAccessConfirmed?: { value: boolean };
  sparseMigrated?: { value: boolean };

  // Helpers from app
  updateSparseInfo?: () => Promise<void>;
  refreshStatus?: () => Promise<void>;
  updateModuleStatus?: () => void;

  ANIMATION_DELAYS?: Record<string, number>;
};

let deps: ResizeDeps | null = null;

/**
 * Initialize the module with a dependency bag.
 */
export function init(d: ResizeDeps) {
  deps = d;
}

/**
 * Trim sparse image:
 * - Ensures prerequisites are met (root access, sparse image exists)
 * - Shows confirm dialog
 * - Uses centralized prepareActionExecution + executeCommandWithProgress flow if available
 */
export async function trimSparseImage() {
  if (!deps) return;
  const d = deps;

  // Guard: concurrent command
  if (d.activeCommandId && d.activeCommandId.value) {
    d.appendConsole(
      "⚠ Another command is already running. Please wait...",
      "warn",
    );
    return;
  }

  // Guard: root access & sparse present
  if (d.rootAccessConfirmed && !d.rootAccessConfirmed.value) {
    d.appendConsole(
      "Cannot trim sparse image: root access not available",
      "err",
    );
    return;
  }

  if (d.sparseMigrated && !d.sparseMigrated.value) {
    d.appendConsole("Sparse image not detected - cannot trim", "err");
    return;
  }

  // Confirm action
  const confirmed = d.showConfirmDialog
    ? await d.showConfirmDialog(
        "Trim Sparse Image",
        "This will run fstrim to reclaim unused space in the sparse image.\n\nThe operation may take a few seconds and space reclamation happens gradually. Continue?",
        "Trim",
        "Cancel",
      )
    : true;

  if (!confirmed) return;

  // Close popups (UI politely)
  d.disableAllActions?.(true);
  d.disableSettingsPopup?.(true);

  // Update status & create progress indicator via helper
  d.updateSparseInfo?.(); // keep aside - update on completion
  d.prepareActionExecution?.(
    "Trimming Sparse Image",
    "Trimming sparse image",
    "dots",
  ).catch(() => {});

  // Use executeCommandWithProgress if available
  const cmd = `sh ${d.PATH_CHROOT_SH} fstrim`;

  if (d.executeCommandWithProgress) {
    const commandId = d.executeCommandWithProgress({
      cmd,
      progress: null, // prepareActionExecution was used earlier by caller in original app
      onSuccess: () => {
        d.appendConsole("✓ Sparse image trimmed successfully", "success");
        d.appendConsole("Space may be reclaimed after a few minutes", "info");
        d.appendConsole("━━━ Trim Complete ━━━", "success");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        d.updateSparseInfo?.();
        setTimeout(
          () => d.refreshStatus?.(),
          d.ANIMATION_DELAYS?.STATUS_REFRESH || 500,
        );
      },
      onError: () => {
        d.appendConsole("✗ Sparse image trim failed", "err");
        d.appendConsole("This may be expected on some Android kernels", "warn");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        d.updateSparseInfo?.();
        setTimeout(
          () => d.refreshStatus?.(),
          d.ANIMATION_DELAYS?.STATUS_REFRESH || 500,
        );
      },
      useValue: true,
      activeCommandIdRef: d.activeCommandId,
    });

    if (!commandId) {
      // validation failed - cleanup
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
    }

    return;
  }

  // Fallback: run async
  try {
    const result = await d.runCommandAsyncPromise?.(cmd, { onOutput: (line) => d.appendConsole(line) });
    if (result?.success) {
      d.appendConsole("✓ Sparse image trimmed successfully", "success");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      d.updateSparseInfo?.();
      setTimeout(
        () => d.refreshStatus?.(),
        d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
      );
    } else {
      d.appendConsole("✗ Sparse image trim failed", "err");
      d.appendConsole("This may be expected on some Android kernels", "warn");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      d.updateSparseInfo?.();
      setTimeout(
        () => d.refreshStatus?.(),
        d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
      );
    }
  } catch (e: any) {
    d.appendConsole("✗ Sparse image trim failed", "err");
    d.appendConsole("This may be expected on some Android kernels", "warn");
    d.updateModuleStatus?.();
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
    d.updateSparseInfo?.();
    setTimeout(
      () => d.refreshStatus?.(),
      d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
    );
  }
}

/**
 * Resize sparse image:
 * - Show size selection
 * - Confirm destructive operation (with warnings about shrinking/growing)
 * - Use migrate/resize script via PATH_CHROOT_SH
 */
export async function resizeSparseImage() {
  if (!deps) return;
  const d = deps;

  // Guard: concurrent command
  if (d.activeCommandId && d.activeCommandId.value) {
    d.appendConsole(
      "⚠ Another command is already running. Please wait...",
      "warn",
    );
    return;
  }

  // Guard: root access
  if (d.rootAccessConfirmed && !d.rootAccessConfirmed.value) {
    d.appendConsole(
      "Cannot resize sparse image: root access not available",
      "err",
    );
    return;
  }

  // Ask for new size via the optional dialog helper
  const newSizeGb = d.showSizeSelectionDialog
    ? await d.showSizeSelectionDialog()
    : null;
  if (!newSizeGb) return;

  // Attempt to detect current allocated size (best-effort)
  let currentAllocatedGb = "Unknown";
  try {
    if (d.runCmdSync && d.CHROOT_DIR) {
      const apparentSizeCmd = `ls -lh ${d.CHROOT_DIR}/rootfs.img | tr -s ' ' | cut -d' ' -f5`;
      const apparentSizeStr = await d.runCmdSync(apparentSizeCmd);
      currentAllocatedGb = String(apparentSizeStr || "")
        .trim()
        .replace(/\\.0G$/, "GB")
        .replace(/G$/, "GB");
    }
  } catch {
    // Keep Unknown
  }

  // Confirm large operation
  const confirm = d.showConfirmDialog
    ? await d.showConfirmDialog(
        "Resize Sparse Image",
        `⚠️ EXTREME WARNING: This operation can CORRUPT your filesystem!\n\nYou MUST create a backup before proceeding.\n\nDO NOT close this window or interrupt the process.\n\nCurrent allocated: ${currentAllocatedGb}\nNew size: ${String(newSizeGb)}GB\n\nContinue?`,
        "Resize",
        "Cancel",
      )
    : true;

  if (!confirm) return;

  // Close settings & start progress UI
  d.closeSettingsPopup?.();
  await new Promise((r) =>
    setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_LONG ?? 700),
  );

  d.disableAllActions?.(true);
  d.disableSettingsPopup?.(true);

  d.updateStatus?.("resizing");

  const prepare = d.prepareActionExecution
    ? await d.prepareActionExecution(
        `Resizing Sparse Image to ${String(newSizeGb)}GB`,
        "Preparing resize operation",
        "dots",
      )
    : null;

  const cmdStr = `sh ${d.PATH_CHROOT_SH} resize --webui ${String(newSizeGb)}`;

  if (d.executeCommandWithProgress) {
    const commandId = d.executeCommandWithProgress({
      cmd: cmdStr,
      progress: prepare
        ? {
            progressLine: prepare.progressLine,
            progressInterval: prepare.interval,
          }
        : null,
      onSuccess: () => {
        d.appendConsole("✅ Sparse image resized successfully", "success");
        d.appendConsole(`New size: ${newSizeGb}GB`, "info");
        d.appendConsole("━━━ Resize Complete ━━━", "success");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        d.updateSparseInfo?.();
        setTimeout(
          () => d.refreshStatus?.(),
          d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
        );
      },
      onError: () => {
        d.appendConsole("✗ Sparse image resize failed", "err");
        d.appendConsole("Check the logs above for details", "err");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        d.updateSparseInfo?.();
        setTimeout(
          () => d.refreshStatus?.(),
          d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
        );
      },
      useValue: true,
      activeCommandIdRef: d.activeCommandId,
    });

    if (!commandId) {
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
    }
    return;
  }

  // fallback to async command
  try {
    const result = await d.runCommandAsyncPromise?.(cmdStr, { onOutput: (line) => d.appendConsole(line) });
    if (result?.success) {
      d.appendConsole("✅ Sparse image resized successfully", "success");
      d.appendConsole(`New size: ${newSizeGb}GB`, "info");
      d.appendConsole("━━━ Resize Complete ━━━", "success");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      d.updateSparseInfo?.();
      setTimeout(
        () => d.refreshStatus?.(),
        d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
      );
    } else {
      d.appendConsole("✗ Sparse image resize failed", "err");
      d.appendConsole("Check the logs above for details", "err");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      d.updateSparseInfo?.();
      setTimeout(
        () => d.refreshStatus?.(),
        d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
      );
    }
  } catch (e: any) {
    d.appendConsole("✗ Sparse image resize failed", "err");
    d.appendConsole("Check the logs above for details", "err");
    d.updateModuleStatus?.();
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
    d.updateSparseInfo?.();
    setTimeout(
      () => d.refreshStatus?.(),
      d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
    );
  }
}

/**
 * Attach to window for compatibility with the legacy global object.
 */
const ResizeFeature = {
  init,
  trimSparseImage,
  resizeSparseImage,
};

if (typeof window !== "undefined") {
  try {
    (window as any).ResizeFeature = ResizeFeature;
  } catch {}
}

export default ResizeFeature;

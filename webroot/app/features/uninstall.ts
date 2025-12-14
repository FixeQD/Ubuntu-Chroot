import { CommandResult } from "@/composables/useNativeCmd";

export type UninstallDeps = {
  activeCommandId?: { value: string | null };
  rootAccessConfirmed?: { value: boolean };
  appendConsole: (text: string, cls?: string) => void;
  showConfirmDialog?: (
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string,
  ) => Promise<boolean>;
  closeSettingsPopup?: () => void;
  ANIMATION_DELAYS?: Record<string, number>;
  PATH_CHROOT_SH: string;
  ProgressIndicator?: {
    create: (
      text: string,
      type?: "spinner" | "dots",
      el?: HTMLElement | null,
    ) => { progressLine: HTMLElement; interval?: any } | null;
    remove: (
      handle: { progressLine: HTMLElement; interval?: any } | null,
    ) => void;
    update?: (
      handle: { progressLine: HTMLElement; interval?: any } | null,
      text?: string,
    ) => void;
  };
  disableAllActions?: (disabled: boolean) => void;
  disableSettingsPopup?: (disabled: boolean, chrootExists?: boolean) => void;
  runCmdAsync?: (
    cmd: string,
    onComplete?: (result: any) => void,
  ) => string | null;
  runCommandAsyncPromise?: (cmd: string, options?: { asRoot?: boolean; debug?: boolean; onOutput?: (line: string) => void }) => Promise<CommandResult>;
  runCmdSync?: (cmd: string) => Promise<string>;
  ensureChrootStopped?: () => Promise<boolean>;
  prepareActionExecution?: (
    headerText: string,
    progressText: string,
    progressType?: "spinner" | "dots",
  ) => Promise<{ progressLine: HTMLElement; interval?: any } | null>;
  executeCommandWithProgress?: (opts: {
    cmd: string;
    progress: { progressLine: HTMLElement; progressInterval?: any } | null;
    onSuccess?: (res?: any) => void;
    onError?: (res?: any) => void;
    onComplete?: (res?: any) => void;
    useValue?: boolean;
    activeCommandIdRef?: { value: string | null };
  }) => string | null;
  updateStatus?: (s: string) => void;
  refreshStatus?: () => Promise<void>;
  updateModuleStatus?: () => void;
};

let deps: UninstallDeps | null = null;

/**
 * Initialize the uninstall module with a dependency bag.
 */
export function init(d: UninstallDeps) {
  deps = d;
}

export async function uninstallChroot() {
  try {
    if (!deps) return;
    const d = deps;

    // Guard: don't run if a command is already active
    if (d.activeCommandId && d.activeCommandId.value) {
      d.appendConsole(
        "⚠ Another command is already running. Please wait...",
        "warn",
      );
      return;
    }

    // Ask for confirmation
    alert(
      "Are you sure you want to uninstall the chroot environment?\n\nThis will permanently delete all data in the chroot and cannot be undone.",
    );
    const confirmed = true;

    d.closeSettingsPopup?.();
    await new Promise((r) =>
      setTimeout(r, d.ANIMATION_DELAYS?.INPUT_FOCUS ?? 120),
    );
    d.updateStatus?.("uninstalling");
    await new Promise((r) =>
      setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_VERY_LONG ?? 750),
    );

    // Disable UI while uninstalling
    d.disableAllActions?.(true);
    d.disableSettingsPopup?.(true);

    // Stop chroot if it's running, using the provided helper
    if (d.ensureChrootStopped) {
      try {
        const stopped = await d.ensureChrootStopped();
        if (!stopped) {
          d.appendConsole("✗ Failed to stop chroot - uninstall aborted", "err");
          if (d.activeCommandId) d.activeCommandId.value = null;
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          return;
        }
      } catch (err: any) {
        d.appendConsole(
          "✗ Failed to ensure chroot stopped - uninstall aborted",
          "err",
        );
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        return;
      }
    }

    // Prepare an action header and progress indicator
    const progress = d.prepareActionExecution
      ? await d.prepareActionExecution(
          "Starting Uninstallation",
          "Uninstalling chroot",
          "dots",
        )
      : null;

    const cmdStr = `sh ${d.PATH_CHROOT_SH} uninstall --webui`;

    // Prefer the higher-level executeCommandWithProgress if available
    if (d.executeCommandWithProgress) {
      const commandId = d.executeCommandWithProgress({
        cmd: cmdStr,
        progress: progress
          ? {
              progressLine: progress.progressLine,
              progressInterval: progress.interval,
            }
          : null,
        onSuccess: async (result?: any) => {
          d.appendConsole("✅ Chroot uninstalled successfully!", "success");
          d.appendConsole("All chroot data has been removed.", "info");
          d.appendConsole("━━━ Uninstallation Complete ━━━", "success");

          // After uninstall, update status & refresh UI state
          d.updateStatus?.("stopped");
          d.updateModuleStatus?.();
          d.disableAllActions?.(true);
          d.disableSettingsPopup?.(false, false);

          // Force a status refresh so UI shows chroot missing and appropriate buttons
          try {
            await d.refreshStatus?.();
          } catch {
            // ignore refresh errors
          }
        },
        onError: async (result?: any) => {
          d.appendConsole("✗ Uninstallation failed", "err");
          d.appendConsole("Check the logs above for details.", "err");
          d.updateModuleStatus?.();
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, false);

          try {
            await d.refreshStatus?.();
          } catch {
            // ignore
          }
        },
        useValue: true,
        activeCommandIdRef: d.activeCommandId,
      });

      if (!commandId) {
        // Validation probably failed; re-enable UI
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, false);
      }
      return;
    }

    // Fallback: run asynchronously
    try {
      const result = await d.runCommandAsyncPromise?.(cmdStr, { onOutput: (line) => d.appendConsole(line) });
      if (result?.success) {
        d.appendConsole("✅ Chroot uninstalled successfully!", "success");
        d.appendConsole("All chroot data has been removed.", "info");
        d.appendConsole("━━━ Uninstallation Complete ━━━", "success");
        d.updateStatus?.("stopped");
        d.updateModuleStatus?.();
        d.disableAllActions?.(true);
        d.disableSettingsPopup?.(false, false);

        try {
          await d.refreshStatus?.();
        } catch {
          // ignore
        }
      } else {
        d.appendConsole("✗ Uninstallation failed", "err");
        d.appendConsole("Check the logs above for details.", "err");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, false);

        try {
          await d.refreshStatus?.();
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      d.appendConsole("✗ Uninstallation failed", "err");
      d.appendConsole(String(err?.message || err), "err");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, false);

      try {
        await d.refreshStatus?.();
      } catch {
        // ignore
      }
    } finally {
      // Ensure progress indicator is removed
      if (progress && d.ProgressIndicator) {
        try {
          d.ProgressIndicator.remove(progress);
        } catch {}
      }
    }
  } catch (error: any) {
    console.error("Error in uninstallChroot:", error);
    // Try to append to console if possible
    if (deps?.appendConsole) {
      deps.appendConsole(
        `Uninstall error: ${String(error?.message || error)}`,
        "err",
      );
    }
  }
}

/**
 * Minimal compatibility object (legacy window-based module)
 */
export const UninstallFeature = {
  init,
  uninstallChroot,
};

if (typeof window !== "undefined") {
  try {
    (window as any).UninstallFeature = UninstallFeature;
  } catch {
    /* ignore */
  }
}

export default UninstallFeature;

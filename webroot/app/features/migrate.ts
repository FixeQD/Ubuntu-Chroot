import { CommandResult } from "@/composables/useNativeCmd";

export type MigrateDeps = {
  // UI & console helpers
  appendConsole: (message: string, cls?: string) => void;

  // Dialogs and selection helpers
  showSizeSelectionDialog?: () => Promise<string | number | null>;
  showConfirmDialog?: (
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string,
  ) => Promise<boolean>;

  // Generic app helpers
  closeSettingsPopup?: () => void;
  ANIMATION_DELAYS?: Record<string, number>;

  // Execution helpers
  CHROOT_DIR: string;
  PATH_CHROOT_SH: string;
  runCmdSync?: (cmd: string) => Promise<string>;
  runCmdAsync?: (cmd: string, onComplete?: (res: any) => void) => string | null;
  runCommandAsyncPromise?: (cmd: string, options?: { asRoot?: boolean; debug?: boolean; onOutput?: (line: string) => void }) => Promise<CommandResult>;
  executeCommandWithProgress?: (options: {
    cmd: string;
    progress: { progressLine: HTMLElement; progressInterval?: any } | null;
    onSuccess?: (result?: any) => void;
    onError?: (result?: any) => void;
    onComplete?: (result?: any) => void;
    useValue?: boolean;
    activeCommandIdRef?: { value: string | null } | undefined;
  }) => string | null;

  // State & UI
  activeCommandId?: { value: string | null };
  hotspotActive?: { value: boolean };
  sparseMigrated?: { value: boolean };
  disableAllActions?: (b: boolean) => void;
  disableSettingsPopup?: (b: boolean, chrootExists?: boolean) => void;
  prepareActionExecution?: (
    headerText: string,
    progressText: string,
    progressType?: "spinner" | "dots",
  ) => Promise<{ progressLine: HTMLElement; interval?: any } | null>;
  ProgressIndicator?: { create: any; remove: any; update?: any };

  updateStatus?: (s: string) => void;
  updateModuleStatus?: () => void;
  ensureChrootStopped?: () => Promise<boolean>;
  refreshStatus?: () => Promise<void>;
};

let deps: MigrateDeps | null = null;

/**
 * Initialize the MigrateFeature module.
 * The dependencies object should be provided by the main UI for full integration.
 */
export function init(d: MigrateDeps) {
  deps = d;
}

/**
 * Convert the directory-based rootfs to a sparse ext4 image.
 */
export async function migrateToSparseImage(): Promise<void> {
  if (!deps) return;

  const d = deps;

  // 1) Prompt for size
  const sizeChoice = d.showSizeSelectionDialog
    ? await d.showSizeSelectionDialog()
    : null;
  if (!sizeChoice) {
    // user canceled size selection
    return;
  }
  const sizeGb = String(sizeChoice).trim();
  if (!sizeGb) return;

  // 2) Confirm potentially destructive action
  const confirmFn = d.showConfirmDialog;
  const confirmed = confirmFn
    ? await confirmFn(
        "Migrate to Sparse Image",
        `This will convert your current rootfs to a ${sizeGb}GB sparse ext4 image.\n\n⚠️ IMPORTANT: If your chroot is currently running, it will be stopped automatically.\n\nℹ️ NOTE: Sparse images do not immediately use ${sizeGb}GB of storage. They only consume space as you write data to them, starting small and growing as needed.\n\nWARNING: This process cannot be undone. Make sure you have a backup!\n\nContinue with migration?`,
        "Start Migration",
        "Cancel",
      )
    : true;

  if (!confirmed) return;

  // Close settings popup & give UI a moment to animate
  d.closeSettingsPopup?.();
  await new Promise((r) =>
    setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_LONG ?? 800),
  );

  // Lock UI
  d.disableAllActions?.(true);
  d.disableSettingsPopup?.(true);

  try {
    // If chroot is running, stop it first (via helper)
    if (d.ensureChrootStopped) {
      // this will attempt to stop chroot using app-level helpers with the proper flow
      const stopped = await d.ensureChrootStopped();
      if (!stopped) {
        d.appendConsole("✗ Failed to stop chroot - migration aborted", "err");
        return;
      }
    }

    // Update status in UI
    d.updateStatus?.("migrating");

    // Show header & progress indicator using centralized flow when available
    const progress = d.prepareActionExecution
      ? await d.prepareActionExecution(
          "Starting Sparse Image Migration",
          "Migrating",
          "dots",
        )
      : null;

    // Post useful warnings in console for the user
    d.appendConsole(`Target size: ${sizeGb}GB sparse ext4 image`, "info");
    d.appendConsole("DO NOT CLOSE THIS WINDOW!", "warn");

    // Command to execute - use the sparsemgr.sh helper located in CHROOT_DIR
    const migrateCommand = `sh ${d.CHROOT_DIR}/sparsemgr.sh migrate ${sizeGb}`;

    // Use the high-level executeCommandWithProgress if available (keeps consistent UX)
    if (d.executeCommandWithProgress) {
      const cmdId = d.executeCommandWithProgress({
        cmd: migrateCommand,
        progress: progress
          ? {
              progressLine: progress.progressLine,
              progressInterval: progress.interval,
            }
          : null,
        onSuccess: () => {
          d.appendConsole(
            "✅ Sparse image migration completed successfully!",
            "success",
          );
          d.appendConsole(
            "Your rootfs has been converted to a sparse image.",
            "info",
          );
          d.appendConsole("━━━ Migration Complete ━━━", "success");

          if (d.sparseMigrated) d.sparseMigrated.value = true;
          d.updateModuleStatus?.();
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          // Refresh status after a small delay to avoid UI flicker
          setTimeout(
            () => d.refreshStatus?.(),
            (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
          );
        },
        onError: () => {
          d.appendConsole("✗ Sparse image migration failed!", "err");
          d.appendConsole("Check the logs above for details.", "err");
          d.appendConsole("━━━ Migration Failed ━━━", "err");

          d.updateModuleStatus?.();
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
        },
        onComplete: () => {
          // no-op here; the feature handlers above will do final steps
        },
        useValue: true,
        activeCommandIdRef: d.activeCommandId ?? undefined,
      });

      if (!cmdId) {
        // validation failed (for example, no root access) — cancel UI lock gracefully
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
      }
    } else {
      // Fallback path: use runCommandAsyncPromise
      try {
        const result = await d.runCommandAsyncPromise?.(migrateCommand, { onOutput: (line) => d.appendConsole(line) });
        if (result?.success) {
          d.appendConsole("✅ Sparse image migration completed successfully!", "success");
          if (d.sparseMigrated) d.sparseMigrated.value = true;
          d.updateModuleStatus?.();
        } else {
          d.appendConsole("✗ Sparse image migration failed!", "err");
          d.updateModuleStatus?.();
        }
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        setTimeout(
          () => d.refreshStatus?.(),
          (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
        );
      } catch (err: any) {
        d.appendConsole(`✗ Sparse image migration failed: ${String(err?.message || err)}`, "err");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
      } finally {
        if (progress && d.ProgressIndicator) {
          try {
            d.ProgressIndicator?.remove?.(progress);
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch (err: any) {
    d.appendConsole(
      `✗ Sparse image migration aborted: ${String(err?.message || err)}`,
      "err",
    );
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
  }
}

/**
 * Legacy compatibility and default export.
 * The UI will still call `window.MigrateFeature.*` in legacy modules.
 */
const MigrateFeature = {
  init,
  migrateToSparseImage,
};

if (typeof window !== "undefined") {
  try {
    (window as any).MigrateFeature = MigrateFeature;
  } catch {}
}

export default MigrateFeature;

import { DEFAULT_BACKUP_DIR } from "../composables/constants";
import { createApp, nextTick } from "vue";
import type { CommandResult } from "@/composables/useNativeCmd";

// @ts-ignore
import FilePickerPopup from "../components/FilePickerPopup.vue";

export type BackupRestoreDeps = {
  appendConsole: (text: string, cls?: string) => void;
  runCmdSync: (cmd: string) => Promise<string>;
  runCmdAsync?: (cmd: string, onComplete?: (res: any) => void) => string | null;
  runCommandAsyncPromise?: (
    cmd: string,
    options?: {
      asRoot?: boolean;
      debug?: boolean;
      onOutput?: (line: string) => void;
    },
  ) => Promise<CommandResult>;
  Storage: {
    get?: (key: string, defaultValue?: any) => any;
    set?: (key: string, value: any) => void;
    getJSON?: <T = any>(key: string, defaultValue?: T | null) => T | null;
    setJSON?: (key: string, value: any) => void;
  };

  showConfirmDialog: (
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
  };

  disableAllActions?: (disabled: boolean) => void;
  disableSettingsPopup?: (disabled: boolean, chrootExists?: boolean) => void;
  withCommandGuard?: (id: string, fn: () => Promise<void>) => Promise<void>;

  prepareActionExecution?: (
    headerText: string,
    progressText: string,
    progressType?: "spinner" | "dots",
  ) => Promise<{ progressLine: HTMLElement; interval?: any }>;

  executeCommandWithProgress?: (options: {
    cmd: string;
    progress: { progressLine: HTMLElement; progressInterval?: any } | null;
    onSuccess?: (result?: any) => void;
    onError?: (result?: any) => void;
    onComplete?: (result?: any) => void;
    useValue?: boolean;
    activeCommandIdRef?: { value: string | null };
  }) => string | null;

  refreshStatus?: () => Promise<void>;
  ensureChrootStopped?: () => Promise<boolean>;
  updateStatus?: (s: string) => void;
  updateModuleStatus?: () => void;

  activeCommandId?: { value: string | null };
  rootAccessConfirmed?: { value: boolean };
  showProgress?: { value: boolean };
  progressType?: { value: "backup" | "restore" | null };
};

let deps: BackupRestoreDeps | null = null;

/**
 * File picker dialog using Vue component
 */
function showFilePickerDialog(
  title: string,
  message: string,
  defaultPath?: string,
  defaultFilename?: string,
  forRestore = false,
): Promise<string | null> {
  return new Promise((resolve) => {
    const app = createApp(FilePickerPopup, {
      visible: true,
      title,
      message,
      defaultPath,
      defaultFilename,
      forRestore,
      onResolve: (path: string | null) => {
        app.unmount();
        resolve(path);
      },
    });
    const div = document.createElement("div");
    document.body.appendChild(div);
    app.mount(div);
  });
}

/**
 * Initialize the feature module with dependencies
 */
export function init(d: BackupRestoreDeps) {
  deps = d;
}

/**
 * Create a filename for backup with ISO timestamp
 */
function makeBackupFilename() {
  const t = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return `chroot-backup-${t}.tar.gz`;
}

/**
 * Backup the chroot using selected path and the PATH_CHROOT_SH wrapper
 */
export async function backupChroot() {
  if (!deps) return;
  const d = deps;

  d.appendConsole("Backup initiated", "info");

  // Prevent concurrent backups via the active command check
  if (d.activeCommandId && d.activeCommandId.value) {
    d.appendConsole(
      "⚠ Another command is already running. Please wait...",
      "warn",
    );
    return;
  }

  const defaultDir = DEFAULT_BACKUP_DIR;
  const defaultFilename = makeBackupFilename();

  try {
    let backupPath: string | null;
    try {
      backupPath = await showFilePickerDialog(
        "Backup Chroot Environment",
        "Select where to save the backup file.\n\nThe chroot will be stopped during backup if it's currently running.",
        defaultDir,
        defaultFilename,
        false,
      );
    } catch (err) {
      deps!.appendConsole(
        `File picker failed, using default path: ${(err as Error)?.message || String(err)}`,
        "warn",
      );
      backupPath = `${defaultDir}/${defaultFilename}`;
    }

    if (!backupPath) {
      d.appendConsole("Backup cancelled: no path selected", "warn");
      return;
    }

    d.appendConsole(`Backup path selected: ${backupPath}`, "info");

    if (d.showProgress) d.showProgress.value = true;
    if (d.progressType) d.progressType.value = "backup";

    d.closeSettingsPopup?.();
    await new Promise((r) =>
      setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_LONG ?? 400),
    );

    d.disableAllActions?.(true);
    d.disableSettingsPopup?.(true);

    // Check and stop chroot if running
    try {
      const statusOut = d.runCmdSync(`${d.PATH_CHROOT_SH} raw-status`);
      const status = String(statusOut || "")
        .trim()
        .toUpperCase();
      if (status === "RUNNING") {
        d.appendConsole("Stopping chroot before backup...", "info");
        d.runCmdSync(`${d.PATH_CHROOT_SH} stop --no-shell`);
        // Verify stopped
        const verifyOut = d.runCmdSync(`${d.PATH_CHROOT_SH} raw-status`);
        const verifyStatus = String(verifyOut || "")
          .trim()
          .toUpperCase();
        if (verifyStatus !== "STOPPED") {
          d.appendConsole("✗ Failed to stop chroot - backup aborted", "err");
          if (d.activeCommandId) d.activeCommandId.value = null;
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          return;
        }
      }
    } catch (err: any) {
      d.appendConsole(
        `✗ Failed to check/stop chroot: ${String(err?.message || err)} - backup aborted`,
        "err",
      );
      if (d.activeCommandId) d.activeCommandId.value = null;
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      return;
    }

    d.updateStatus?.("backing up");

    const progress = d.prepareActionExecution
      ? await d.prepareActionExecution(
          "Starting Chroot Backup",
          "Backing up chroot",
          "dots",
        )
      : null;

    d.appendConsole(`Starting backup to: ${backupPath}`, "info");
    const cmdStr = `sh ${d.PATH_CHROOT_SH} backup --webui "${backupPath}"`;

    try {
      const pendingOutput: string[] = [];
      const flushOutput = () => {
        if (pendingOutput.length > 0) {
          pendingOutput.forEach((line) => console.log(line));
          pendingOutput.length = 0;
        }
      };
      const throttledFlush = () => {
        flushOutput();
        setTimeout(throttledFlush, 100);
      };
      throttledFlush();

      const result = await d.runCommandAsyncPromise?.(cmdStr, {
        onOutput: (line) => pendingOutput.push(line),
      });
      flushOutput(); // Final flush
      if (progress) d.ProgressIndicator?.remove(progress);
      if (result?.success) {
        d.appendConsole(`✓ Backup completed successfully`, "success");
        d.appendConsole(`Saved to: ${backupPath}`, "info");
        d.appendConsole("━━━ Backup Complete ━━━", "success");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        setTimeout(
          () => d.refreshStatus?.(),
          d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
        );
      } else {
        d.appendConsole(
          `✗ Backup failed: ${result?.error || "Unknown error"}`,
          "err",
        );
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        setTimeout(
          () => d.refreshStatus?.(),
          d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
        );
      }
    } catch (err: any) {
      if (progress) d.ProgressIndicator?.remove(progress);
      d.appendConsole(`✗ Backup failed: ${String(err?.message || err)}`, "err");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      setTimeout(
        () => d.refreshStatus?.(),
        d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
      );
    }
  } catch (err: any) {
    d.appendConsole(`Backup aborted: ${String(err?.message || err)}`, "warn");
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
  } finally {
    if (d.showProgress) d.showProgress.value = false;
    if (d.progressType) d.progressType.value = null;
  }
}

/**
 * Restores a chroot from a backup file.
 */
export async function restoreChroot() {
  if (!deps) return;
  const d = deps;

  // Prevent concurrent operations
  if (d.activeCommandId && d.activeCommandId.value) {
    d.appendConsole(
      "⚠ Another command is already running. Please wait...",
      "warn",
    );
    return;
  }

  // Check root access presence if available
  if (d.rootAccessConfirmed && !d.rootAccessConfirmed.value) {
    d.appendConsole("Cannot restore chroot: root access not available", "err");
    return;
  }

  try {
    let backupPath: string | null;
    try {
      backupPath = await showFilePickerDialog(
        "Restore Chroot Environment",
        "Select the backup file to restore from.\n\nWARNING: This will permanently delete your current chroot environment!",
        DEFAULT_BACKUP_DIR,
        "",
        true, // forRestore
      );
    } catch (err) {
      deps!.appendConsole(
        `File picker error: ${(err as Error)?.message || String(err)}`,
        "err",
      );
      return;
    }

    if (!backupPath) return;

    if (d.showProgress) d.showProgress.value = true;
    if (d.progressType) d.progressType.value = "restore";

    d.closeSettingsPopup?.();
    await new Promise((r) =>
      setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_LONG ?? 400),
    );

    d.disableAllActions?.(true);
    d.disableSettingsPopup?.(true);

    // Check and stop chroot if running
    try {
      const statusOut = d.runCmdSync(`${d.PATH_CHROOT_SH} raw-status`);
      const status = String(statusOut || "")
        .trim()
        .toUpperCase();
      if (status === "RUNNING") {
        d.appendConsole("Stopping chroot before restore...", "info");
        d.runCmdSync(`${d.PATH_CHROOT_SH} stop --no-shell`);
        // Verify stopped
        const verifyOut = d.runCmdSync(`${d.PATH_CHROOT_SH} raw-status`);
        const verifyStatus = String(verifyOut || "")
          .trim()
          .toUpperCase();
        if (verifyStatus !== "STOPPED") {
          d.appendConsole("✗ Failed to stop chroot - restore aborted", "err");
          if (d.activeCommandId) d.activeCommandId.value = null;
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          return;
        }
      }
    } catch (err: any) {
      d.appendConsole(
        `✗ Failed to check/stop chroot: ${String(err?.message || err)} - restore aborted`,
        "err",
      );
      if (d.activeCommandId) d.activeCommandId.value = null;
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      return;
    }

    d.updateStatus?.("restoring");

    const progress = d.prepareActionExecution
      ? await d.prepareActionExecution(
          "Starting Chroot Restore",
          "Restoring chroot",
          "dots",
        )
      : null;

    const cmdStr = `sh ${d.PATH_CHROOT_SH} restore --webui "${backupPath}"`;

    try {
      const pendingOutput: string[] = [];
      const flushOutput = () => {
        if (pendingOutput.length > 0) {
          pendingOutput.forEach((line) => console.log(line));
          pendingOutput.length = 0;
        }
      };
      const throttledFlush = () => {
        flushOutput();
        setTimeout(throttledFlush, 100);
      };
      throttledFlush();

      const result = await d.runCommandAsyncPromise?.(cmdStr, {
        onOutput: (line) => pendingOutput.push(line),
      });
      flushOutput(); // Final flush
      if (progress) d.ProgressIndicator?.remove?.(progress ?? null);
      if (result?.success) {
        d.appendConsole("✓ Restore completed successfully", "success");
        d.appendConsole("The chroot environment has been restored", "info");
        d.appendConsole("━━━ Restore Complete ━━━", "success");
        d.updateStatus?.("stopped");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        setTimeout(
          () => d.refreshStatus?.(),
          (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
        );
      } else {
        d.appendConsole("✗ Restore failed", "err");
        d.updateModuleStatus?.();
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        setTimeout(
          () => d.refreshStatus?.(),
          (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
        );
      }
    } catch (err: any) {
      if (progress) d.ProgressIndicator?.remove?.(progress ?? null);
      d.appendConsole("✗ Restore failed", "err");
      d.updateModuleStatus?.();
      d.disableAllActions?.(false);
      d.disableSettingsPopup?.(false, true);
      setTimeout(
        () => d.refreshStatus?.(),
        (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
      );
    }
  } catch (err: any) {
    d.appendConsole(`Restore aborted: ${String(err?.message || err)}`, "warn");
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
  } finally {
    if (d.showProgress) d.showProgress.value = false;
    if (d.progressType) d.progressType.value = null;
  }
}

/**
 * Minimal compatibility object available on window for legacy app.js usage
 */
export const BackupRestoreFeature = {
  init,
  backupChroot,
  restoreChroot,
};

if (typeof window !== "undefined") {
  try {
    (window as any).BackupRestoreFeature = BackupRestoreFeature;
  } catch {}
}

export default BackupRestoreFeature;

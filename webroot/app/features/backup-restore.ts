import { DEFAULT_BACKUP_DIR } from "../composables/constants";
import { createApp } from "vue";
import FilePickerPopup from "../components/FilePickerPopup.vue"; // Ignore, it works (Why the fu"k it shows that there's an error)

export type BackupRestoreDeps = {
  appendConsole: (text: string, cls?: string) => void;
  runCmdSync: (cmd: string) => Promise<string>;
  runCmdAsync?: (cmd: string, onComplete?: (res: any) => void) => string | null;
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

    if (!backupPath) return;

    const confirm = d.showConfirmDialog;

    let ok: boolean;
    try {
      ok = await confirm(
        "Backup Chroot Environment",
        `This will create a compressed backup of your chroot environment.\n\nThe chroot will be stopped during backup if it's currently running.\n\nBackup location: ${backupPath}\n\nContinue?`,
        "Backup",
        "Cancel",
      );
    } catch (err) {
      d.appendConsole(
        `Confirmation dialog error: ${(err as Error)?.message || String(err)}`,
        "err",
      );
      return;
    }

    if (!ok) return;

    d.closeSettingsPopup?.();
    await new Promise((r) =>
      setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_LONG ?? 400),
    );

    d.disableAllActions?.(true);
    d.disableSettingsPopup?.(true);

    if (d.ensureChrootStopped) {
      const isStopped = await d.ensureChrootStopped();
      if (!isStopped) {
        d.appendConsole("✗ Failed to stop chroot - backup aborted", "err");
        if (d.activeCommandId) d.activeCommandId.value = null;
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        return;
      }
    }

    d.updateStatus?.("backing up");

    const progress = d.prepareActionExecution
      ? await d.prepareActionExecution(
          "Starting Chroot Backup",
          "Backing up chroot",
          "dots",
        )
      : null;

    const cmdStr = `sh ${d.PATH_CHROOT_SH} backup --webui "${backupPath}"`;

    if (d.executeCommandWithProgress) {
      const commandId = d.executeCommandWithProgress({
        cmd: cmdStr,
        progress: progress
          ? {
              progressLine: progress.progressLine,
              progressInterval: progress.interval,
            }
          : null,
        onSuccess: (result) => {
          d.appendConsole("✓ Backup completed successfully", "success");
          d.appendConsole(`Saved to: ${backupPath}`, "info");
          d.appendConsole("━━━ Backup Complete ━━━", "success");
          d.updateModuleStatus?.();
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          setTimeout(
            () => d.refreshStatus?.(),
            d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
          );
        },
        onError: (result) => {
          d.appendConsole("✗ Backup failed", "err");
          d.updateModuleStatus?.();
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          setTimeout(
            () => d.refreshStatus?.(),
            d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500,
          );
        },
        onComplete: () => {},
        useValue: true,
        activeCommandIdRef: d.activeCommandId ?? undefined,
      });

      if (!commandId) {
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
      }
    } else {
      try {
        const out = await d.runCmdSync(cmdStr);
        if (progress) d.ProgressIndicator?.remove(progress);
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
      } catch (err: any) {
        if (progress) d.ProgressIndicator?.remove(progress);
        d.appendConsole(
          `✗ Backup failed: ${String(err?.message || err)}`,
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
    }
  } catch (err: any) {
    d.appendConsole(`Backup aborted: ${String(err?.message || err)}`, "warn");
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
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

    const confirmFn = d.showConfirmDialog;

    let confirmed: boolean;
    try {
      confirmed = await confirmFn(
        "Restore Chroot Environment",
        `⚠️ WARNING: This will permanently delete your current chroot environment and replace it with the backup!\n\nAll current data in the chroot will be lost.\n\nBackup file: ${backupPath}\n\nThis action cannot be undone. Continue?`,
        "Restore",
        "Cancel",
      );
    } catch (err) {
      d.appendConsole(
        `Confirmation dialog error: ${(err as Error)?.message || String(err)}`,
        "err",
      );
      return;
    }

    if (!confirmed) return;

    d.closeSettingsPopup?.();
    await new Promise((r) =>
      setTimeout(r, d.ANIMATION_DELAYS?.POPUP_CLOSE_LONG ?? 400),
    );

    d.disableAllActions?.(true);
    d.disableSettingsPopup?.(true);

    if (d.ensureChrootStopped) {
      const stopped = await d.ensureChrootStopped();
      if (!stopped) {
        d.appendConsole("✗ Failed to stop chroot - restore aborted", "err");
        if (d.activeCommandId) d.activeCommandId.value = null;
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
        return;
      }
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

    if (d.executeCommandWithProgress) {
      const commandId = d.executeCommandWithProgress({
        cmd: cmdStr,
        progress: progress
          ? {
              progressLine: progress.progressLine,
              progressInterval: progress.interval,
            }
          : null,
        onSuccess: (r) => {
          d.appendConsole("✓ Restore completed successfully", "success");
          d.appendConsole("The chroot environment has been restored", "info");
          d.appendConsole("━━━ Restore Complete ━━━", "success");
          d.updateStatus?.("stopped");
          d.updateModuleStatus?.();
          d.disableAllActions?.(true);
          d.disableSettingsPopup?.(false, true);
          setTimeout(
            () => d.refreshStatus?.(),
            (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
          );
        },
        onError: (r) => {
          d.appendConsole("✗ Restore failed", "err");
          d.updateModuleStatus?.();
          d.disableAllActions?.(false);
          d.disableSettingsPopup?.(false, true);
          setTimeout(
            () => d.refreshStatus?.(),
            (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
          );
        },
        onComplete: () => {},
        useValue: true,
        activeCommandIdRef: d.activeCommandId ?? undefined,
      });

      if (!commandId) {
        d.disableAllActions?.(false);
        d.disableSettingsPopup?.(false, true);
      }
    } else {
      try {
        const out = await d.runCmdSync(cmdStr);
        if (progress) d.ProgressIndicator?.remove?.(progress ?? null);
        d.appendConsole("✓ Restore completed successfully", "success");
        d.appendConsole("The chroot environment has been restored", "info");
        d.appendConsole("━━━ Restore Complete ━━━", "success");
        d.updateStatus?.("stopped");
        d.updateModuleStatus?.();
        d.disableAllActions?.(true);
        d.disableSettingsPopup?.(false, true);
        setTimeout(
          () => d.refreshStatus?.(),
          (d.ANIMATION_DELAYS?.STATUS_REFRESH ?? 500) * 2,
        );
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
    }
  } catch (err: any) {
    d.appendConsole(`Restore aborted: ${String(err?.message || err)}`, "warn");
    d.disableAllActions?.(false);
    d.disableSettingsPopup?.(false, true);
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

import useConsole from "@/composables/useConsole";
import BackupRestoreFeature from "@/features/backup-restore";
import UninstallFeature from "@/features/uninstall";
import ResizeFeature from "@/features/resize";

export function useSettings(consoleApi: ReturnType<typeof useConsole>) {
  function appendConsole(text: string, cls?: string) {
    consoleApi.append(text, cls);
  }

  function openSettingsPopup() {
    const el = document.getElementById("settings-popup");
    if (el) el.classList.add("active");
    // loadPostExecScript is handled in useChroot
  }

  function closeSettingsPopup() {
    const el = document.getElementById("settings-popup");
    if (el) el.classList.remove("active");
  }

  function openSparseSettingsPopup() {
    const el = document.getElementById("sparse-settings-popup");
    if (el) el.classList.add("active");
  }

  function closeSparseSettingsPopup() {
    const el = document.getElementById("sparse-settings-popup");
    if (el) el.classList.remove("active");
  }

  async function backupChroot() {
    if (
      (window as any).BackupRestoreFeature &&
      (window as any).BackupRestoreFeature.backupChroot
    ) {
      await (window as any).BackupRestoreFeature.backupChroot();
    }
  }

  async function restoreChroot() {
    if (
      (window as any).BackupRestoreFeature &&
      (window as any).BackupRestoreFeature.restoreChroot
    ) {
      await (window as any).BackupRestoreFeature.restoreChroot();
    }
  }

  async function uninstallChroot() {
    if (
      (window as any).UninstallFeature &&
      (window as any).UninstallFeature.uninstallChroot
    ) {
      await (window as any).UninstallFeature.uninstallChroot();
    }
  }

  async function trimSparseImage() {
    if (
      (window as any).ResizeFeature &&
      (window as any).ResizeFeature.trimSparseImage
    ) {
      await (window as any).ResizeFeature.trimSparseImage();
    }
  }

  async function resizeSparseImage() {
    if (
      (window as any).ResizeFeature &&
      (window as any).ResizeFeature.resizeSparseImage
    ) {
      await (window as any).ResizeFeature.resizeSparseImage();
    }
  }

  return {
    openSettingsPopup,
    closeSettingsPopup,
    openSparseSettingsPopup,
    closeSparseSettingsPopup,
    backupChroot,
    restoreChroot,
    uninstallChroot,
    trimSparseImage,
    resizeSparseImage,
  };
}

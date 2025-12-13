import { ref } from "vue";
import useNativeCmd from "@/composables/useNativeCmd";
import useConsole from "@/composables/useConsole";
import { Storage, StateManager } from "@/composables/useStateManager";
import ProgressIndicator from "@/services/progressIndicator";
import {
  ButtonState,
  PopupManager,
  disableAllActions,
  disableSettingsPopup,
} from "@/composables/utils";
import {
  CHROOT_DIR,
  PATH_CHROOT_SH,
  HOTSPOT_SCRIPT,
  FORWARD_NAT_SCRIPT,
  OTA_UPDATER,
} from "@/composables/constants";
import HotspotFeature from "@/features/hotspot";
import ForwardNatFeature from "@/features/forward-nat";
import BackupRestoreFeature from "@/features/backup-restore";
import UninstallFeature from "@/features/uninstall";
import ResizeFeature from "@/features/resize";
import MigrateFeature from "@/features/migrate";

export function useFeatures(
  updateStatus: (state: string) => void,
  refreshStatus: () => Promise<void>,
) {
  const cmd = useNativeCmd();
  const consoleApi = useConsole();

  const consoleRef = consoleApi.consoleRef;

  const activeCommandId = ref<string | null>(null);
  const rootAccessConfirmed = ref<boolean>(cmd.isAvailable.value);
  const hotspotActive = ref<boolean>(StateManager.get("hotspot"));
  const forwardingActive = ref<boolean>(StateManager.get("forwarding"));
  const sparseMigrated = ref<boolean>(StateManager.get("sparse"));

  function appendConsole(text: string, cls?: string) {
    consoleApi.append(text, cls);
  }

  // Helper: Run a function while ensuring only one command is active
  async function withCommandGuard(commandId: string, fn: () => Promise<void>) {
    if (activeCommandId.value) {
      appendConsole(
        "⚠ Another command is already running. Please wait...",
        "warn",
      );
      return;
    }
    if (!cmd.isAvailable.value) {
      appendConsole("Cannot execute: root access not available", "err");
      return;
    }
    try {
      activeCommandId.value = commandId;
      await fn();
    } finally {
      activeCommandId.value = null;
    }
  }

  function copyConsole() {
    consoleApi.copyLogs();
  }

  function clearConsole() {
    consoleApi.clearConsole();
  }

  // Initialize feature modules (hotspot, forwarding, backup/restore, etc)
  function initFeatureModules() {
    try {
      const els = {
        get hotspotIface() {
          return document.getElementById(
            "hotspot-iface",
          ) as HTMLSelectElement | null;
        },
        get hotspotSsid() {
          return document.getElementById(
            "hotspot-ssid",
          ) as HTMLInputElement | null;
        },
        get hotspotPassword() {
          return document.getElementById(
            "hotspot-password",
          ) as HTMLInputElement | null;
        },
        get hotspotBand() {
          return document.getElementById(
            "hotspot-band",
          ) as HTMLSelectElement | null;
        },
        get hotspotChannel() {
          return document.getElementById(
            "hotspot-channel",
          ) as HTMLSelectElement | null;
        },
        get hotspotPopup() {
          return document.getElementById("hotspot-popup");
        },
        get startHotspotBtn() {
          return document.getElementById("start-hotspot-btn");
        },
        get stopHotspotBtn() {
          return document.getElementById("stop-hotspot-btn");
        },
        get dismissHotspotWarning() {
          return document.getElementById("dismiss-hotspot-warning");
        },

        get forwardNatIface() {
          return document.getElementById(
            "forward-nat-iface",
          ) as HTMLSelectElement | null;
        },
        get forwardNatPopup() {
          return document.getElementById("forward-nat-popup");
        },
        get startForwardingBtn() {
          return document.getElementById("start-forwarding-btn");
        },
        get stopForwardingBtn() {
          return document.getElementById("stop-forwarding-btn");
        },
      };

      const commonDeps = {
        els,
        Storage,
        StateManager,
        CHROOT_DIR,
        PATH_CHROOT_SH,
        HOTSPOT_SCRIPT,
        FORWARD_NAT_SCRIPT,
        OTA_UPDATER,
        appendConsole,
        runCmdSync: (cmdStr: string) => cmd.runCommandSync(cmdStr),
        runCmdAsync: (cmdStr: string, onComplete?: (res: any) => void) =>
          cmd.runCommandAsync(cmdStr, {
            asRoot: true,
            debug: false, // Will be passed from parent
            callbacks: { onComplete },
          }),
        withCommandGuard,
        ANIMATION_DELAYS: {
          POPUP_CLOSE: 450,
          POPUP_CLOSE_LONG: 750,
          POPUP_CLOSE_VERY_LONG: 850,
          STATUS_REFRESH: 500,
          INPUT_FOCUS: 100,
          PROGRESS_SPINNER: 200,
          PROGRESS_DOTS: 400,
        },
        ProgressIndicator,
        disableAllActions,
        disableSettingsPopup,
        ButtonState,
        PopupManager,
        activeCommandId: activeCommandId,
        rootAccessConfirmed: rootAccessConfirmed,
        hotspotActive: hotspotActive,
        forwardingActive: forwardingActive,
        sparseMigrated: sparseMigrated,
        updateStatus: () => {}, // Will be passed from parent
        refreshStatus: () => {}, // Will be passed from parent
      };

      try {
        HotspotFeature?.init?.(commonDeps);
      } catch {}
      try {
        ForwardNatFeature?.init?.(commonDeps);
      } catch {}
      try {
        BackupRestoreFeature?.init?.(commonDeps);
      } catch {}
      try {
        UninstallFeature?.init?.(commonDeps);
      } catch {}
      try {
        ResizeFeature?.init?.(commonDeps);
      } catch {}
      try {
        MigrateFeature?.init?.(commonDeps);
      } catch {}
    } catch (e) {
      appendConsole(
        "Failed to initialize feature modules: " + String(e),
        "warn",
      );
    }
  }

  return {
    activeCommandId,
    rootAccessConfirmed,
    hotspotActive,
    forwardingActive,
    sparseMigrated,
    withCommandGuard,
    copyConsole,
    clearConsole,
    initFeatureModules,
  };
}

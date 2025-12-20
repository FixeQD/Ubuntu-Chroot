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
  consoleApi: ReturnType<typeof useConsole>,
  showProgress: { value: boolean },
  progressTitle: { value: string },
  progressMessage: { value: string },
) {
  const cmd = useNativeCmd();

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
          return (
            (document.getElementById("hotspot-iface") as HTMLSelectElement) ??
            undefined
          );
        },
        get hotspotSsid() {
          return (
            (document.getElementById("hotspot-ssid") as HTMLInputElement) ??
            undefined
          );
        },
        get hotspotPassword() {
          return (
            (document.getElementById("hotspot-password") as HTMLInputElement) ??
            undefined
          );
        },
        get hotspotBand() {
          return (
            (document.getElementById("hotspot-band") as HTMLSelectElement) ??
            undefined
          );
        },
        get hotspotChannel() {
          return (
            (document.getElementById("hotspot-channel") as HTMLSelectElement) ??
            undefined
          );
        },
        get hotspotPopup() {
          return document.getElementById("hotspot-popup") ?? undefined;
        },
        get startHotspotBtn() {
          const el = document.getElementById("start-hotspot-btn");
          return el ? (el as HTMLButtonElement) : undefined;
        },
        get stopHotspotBtn() {
          const el = document.getElementById("stop-hotspot-btn");
          return el ? (el as HTMLButtonElement) : undefined;
        },
        get dismissHotspotWarning() {
          return (
            document.getElementById("dismiss-hotspot-warning") ?? undefined
          );
        },

        get forwardNatIface() {
          return (
            (document.getElementById(
              "forward-nat-iface",
            ) as HTMLSelectElement) ?? undefined
          );
        },
        get forwardNatPopup() {
          return document.getElementById("forward-nat-popup") ?? undefined;
        },
        get startForwardingBtn() {
          const el = document.getElementById("start-forwarding-btn");
          return el ? (el as HTMLButtonElement) : undefined;
        },
        get stopForwardingBtn() {
          const el = document.getElementById("stop-forwarding-btn");
          return el ? (el as HTMLButtonElement) : undefined;
        },
      };

      const StateManagerAdapter = {
        get: (name: string) =>
          (StateManager.get as unknown as any)(name as any),
        set: (name: string, value: boolean) =>
          (StateManager.set as unknown as any)(name as any, value),
      };

      const ProgressIndicatorAdapter = {
        create: (
          text: string,
          type?: "spinner" | "dots",
          el?: HTMLElement | null,
        ) => {
          const h = ProgressIndicator.create(
            text,
            (type as any) || "spinner",
            el,
          );
          // Always return a compatible object (features expect an object, not null)
          return {
            progressLine: (h as any).element as HTMLElement,
            interval: undefined,
            __internalHandle: h,
          } as any;
        },
        remove: (handle?: any) => {
          if (!handle) return;
          const el =
            (handle as any)?.progressLine ?? (handle as any)?.element ?? handle;
          ProgressIndicator.remove(el as any);
        },
        update: (handle?: any, text?: string) => {
          if (!handle) return;
          const el =
            (handle as any)?.progressLine ?? (handle as any)?.element ?? handle;
          ProgressIndicator.update(el as any, text || "");
        },
      };

      const ButtonStateAdapter = {
        setButtonPair: (
          startBtn?: HTMLElement | null | undefined,
          stopBtn?: HTMLElement | null | undefined,
          isActive?: boolean,
        ) => {
          ButtonState.setButtonPair(
            startBtn as any,
            stopBtn as any,
            !!isActive,
          );
        },
        setButton: (
          btn?: HTMLElement | null | undefined,
          enabled?: boolean,
          visible = true,
          opacity: string | null = null,
        ) => {
          ButtonState.setButton(
            btn as any,
            !!enabled,
            visible,
            opacity ?? null,
          );
        },
        setButtons: (buttons: Array<any>) => {
          const adapted = buttons.map((b) => ({
            btn: b.btn as any,
            enabled: b.enabled,
            visible: b.visible,
            opacity: b.opacity,
          }));
          ButtonState.setButtons(adapted);
        },
      };

      const commonDeps = {
        els,
        Storage,
        StateManager: StateManagerAdapter,
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
            debug: false,
            callbacks: { onComplete },
          }),
        runCommandAsyncPromise: (
          cmdStr: string,
          options?: {
            asRoot?: boolean;
            debug?: boolean;
            onOutput?: (line: string) => void;
          },
        ) => cmd.runCommandAsyncPromise(cmdStr, { asRoot: true, ...options }),
        showConfirmDialog: async (
          title: string,
          message: string,
          confirmText?: string,
          cancelText?: string,
        ) => Promise.resolve(window.confirm(message)),
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
        ProgressIndicator: ProgressIndicatorAdapter,
        disableSettingsPopup,
        ButtonState: ButtonStateAdapter,
        PopupManager,
        activeCommandId: activeCommandId,
        rootAccessConfirmed: rootAccessConfirmed,
        hotspotActive: hotspotActive,
        forwardingActive: forwardingActive,
        sparseMigrated: sparseMigrated,
        updateStatus: updateStatus,
        refreshStatus: refreshStatus,
        showProgress: showProgress,
        progressTitle: progressTitle,
        progressMessage: progressMessage,
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

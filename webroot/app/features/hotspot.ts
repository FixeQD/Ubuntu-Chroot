import { NetworkInterfaceManager } from "@/services/NetworkInterfaceManager";

type Nullable<T> = T | null | undefined;

type DepEls = {
  hotspotIface?: HTMLSelectElement;
  hotspotSsid?: HTMLInputElement;
  hotspotPassword?: HTMLInputElement;
  hotspotBand?: HTMLSelectElement;
  hotspotChannel?: HTMLSelectElement;
  hotspotPopup?: HTMLElement;
  startHotspotBtn?: HTMLElement;
  stopHotspotBtn?: HTMLElement;
  // optional refs in the DOM that feature may use:
  dismissHotspotWarning?: HTMLElement;
};

type ProgressHandle = { progressLine: HTMLElement; interval?: number | null };

// Minimal interface for dependencies the feature expects.
interface HotspotDeps {
  els: DepEls;
  Storage: {
    getJSON: (key: string, defaultValue?: any) => any;
    setJSON: (key: string, value: any) => void;
    get: (key: string, defaultValue?: any) => any;
    set: (key: string, value: any) => void;
  };
  StateManager?: {
    set: (name: any, value: any) => void;
  };
  HOTSPOT_SCRIPT: string;
  FORWARD_NAT_SCRIPT?: string;
  appendConsole: (text: string, cls?: string) => void;
  runCmdSync: (cmd: string) => Promise<string>;
  runCmdAsync: (
    cmd: string,
    onComplete?: (result: any) => void,
  ) => string | null;
  withCommandGuard: (id: string, fn: () => Promise<void>) => Promise<void>;
  ANIMATION_DELAYS: Record<string, number>;
  ProgressIndicator: {
    create: (
      text: string,
      type?: "spinner" | "dots",
      el?: HTMLElement | null,
    ) => ProgressHandle;
    remove: (handle?: ProgressHandle | null) => void;
    update: (handle?: ProgressHandle | null, text?: string) => void;
  };
  disableAllActions?: (disabled: boolean) => void;
  disableSettingsPopup?: (disabled: boolean, chrootExists?: boolean) => void;
  ButtonState?: {
    setButtonPair: (
      startBtn: HTMLElement | undefined,
      stopBtn: HTMLElement | undefined,
      isActive: boolean,
    ) => void;
  };
  PopupManager?: {
    open: (popup: HTMLElement | null | undefined) => void;
    close: (popup: HTMLElement | null | undefined) => void;
  };
  prepareActionExecution?: (
    headerText: string,
    progressText: string,
    progressType?: "spinner" | "dots",
  ) => Promise<PlayerProgress>;
  // Shared mutable state objects (refs-like)
  activeCommandId?: { value: string | null };
  rootAccessConfirmed?: { value: boolean };
  hotspotActive?: { value: boolean };
  saveHotspotStatus?: () => void;
  loadHotspotStatus?: () => void;
  updateStatus?: (s: string) => void;
  refreshStatus?: () => Promise<void>;
}

type PlayerProgress = {
  progressLine: HTMLElement;
  interval: any;
};

const HotspotFeature = (() => {
  let deps: Nullable<HotspotDeps> = null;
  let interfaceManager: NetworkInterfaceManager | null = null;

  function init(d: HotspotDeps) {
    deps = d;

    interfaceManager = new NetworkInterfaceManager(
      {
        Storage: deps.Storage,
        appendConsole: deps.appendConsole,
        runCmdSync: deps.runCmdSync,
        rootAccessConfirmed: deps.rootAccessConfirmed,
      },
      deps.HOTSPOT_SCRIPT,
      "chroot_hotspot_interfaces_cache",
      deps.els.hotspotIface || null,
      "chroot_hotspot_iface",
    );

    try {
      fetchInterfaces(true, true).catch(() => {});
    } catch {
      // ignore
    }
  }

  function _getEl<K extends keyof DepEls>(name: K): Nullable<DepEls[K]> {
    if (!deps) return null;
    return (deps.els || ({} as DepEls))[name];
  }

  function _appendConsole(text: string, cls?: string) {
    deps?.appendConsole?.(text, cls);
  }

  async function fetchInterfaces(forceRefresh = false, backgroundOnly = false) {
    if (!interfaceManager) return;
    await interfaceManager.fetchInterfaces(forceRefresh, backgroundOnly);
  }

  async function openHotspotPopup() {
    if (!deps) return;
    deps.PopupManager?.open?.(deps.els.hotspotPopup ?? null);

    if (interfaceManager) {
      interfaceManager.updateSelectElement(deps.els.hotspotIface || null);
    }

    try {
      await fetchInterfaces(false, false);
    } catch {
      // ignore
    }
  }

  function closeHotspotPopup() {
    if (!deps) return;
    deps.PopupManager?.close?.(deps.els.hotspotPopup);
  }

  function showHotspotWarning() {
    const els = deps?.els;
    if (!els) return;
    const warning = els.hotspotPopup
      ? els.hotspotPopup.querySelector("#hotspot-warning")
      : undefined;
    if (warning && warning instanceof HTMLElement) {
      warning.classList.remove("hidden");
    }
  }

  function dismissHotspotWarning() {
    const els = deps?.els;
    if (!els) return;
    const warning = els.hotspotPopup
      ? els.hotspotPopup.querySelector("#hotspot-warning")
      : undefined;
    if (warning && warning instanceof HTMLElement) {
      warning.classList.add("hidden");
      try {
        deps!.Storage.set("chroot_hotspot_warning_dismissed", "true");
      } catch {
        // ignore
      }
    }
  }

  function saveHotspotSettings() {
    if (!deps) return;
    const ifaceEl = deps.els.hotspotIface;
    const ssidEl = deps.els.hotspotSsid;
    const passwordEl = deps.els.hotspotPassword;
    const bandEl = deps.els.hotspotBand;
    const channelEl = deps.els.hotspotChannel;

    const iface = ifaceEl ? ifaceEl.value.trim() : "";
    const ssid = ssidEl ? ssidEl.value.trim() : "";
    const password = passwordEl ? passwordEl.value : "";
    const band = bandEl ? bandEl.value : "";
    const channel = channelEl ? channelEl.value : "";

    const settings = { iface, ssid, password, band, channel };
    try {
      deps.Storage.setJSON("chroot_hotspot_settings", settings);
    } catch {
      // ignore
    }
  }

  async function loadHotspotSettings() {
    if (!deps) return;
    const storage = deps.Storage;
    const saved: any = storage.getJSON?.("chroot_hotspot_settings") || null;
    const selectIface = deps.els.hotspotIface;
    const ssidEl = deps.els.hotspotSsid;
    const passwordEl = deps.els.hotspotPassword;
    const bandEl = deps.els.hotspotBand;
    const channelEl = deps.els.hotspotChannel;

    const constants = (deps as any).APP_CONSTANTS || {
      HOTSPOT: {
        DEFAULT_BAND: "2",
        DEFAULT_CHANNEL_2_4GHZ: "6",
        DEFAULT_CHANNEL_5GHZ: "36",
        CHANNELS_2_4GHZ: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        CHANNELS_5GHZ: [36, 40, 44, 48, 52, 56, 60, 64, 100, 104],
      },
    };

    try {
      // Populate band -> channel options
      if (bandEl && channelEl) {
        const band = saved?.band || constants.HOTSPOT.DEFAULT_BAND || "2";
        bandEl.value = String(band);

        const channels =
          band === "5"
            ? constants.HOTSPOT.CHANNELS_5GHZ
            : constants.HOTSPOT.CHANNELS_2_4GHZ;
        channelEl.innerHTML = "";
        channels.forEach((c: number) => {
          const opt = document.createElement("option");
          opt.value = String(c);
          opt.textContent = String(c);
          channelEl.appendChild(opt);
        });

        // set selected channel
        const savedChannel = saved?.channel
          ? String(saved.channel)
          : band === "5"
            ? String(constants.HOTSPOT.DEFAULT_CHANNEL_5GHZ)
            : String(constants.HOTSPOT.DEFAULT_CHANNEL_2_4GHZ);
        const exists = Array.from(channelEl.options).some(
          (o) => o.value === savedChannel,
        );
        channelEl.value = exists
          ? savedChannel
          : channelEl.options[0]
            ? channelEl.options[0].value
            : "";
      }

      // set SSID & password
      if (ssidEl) ssidEl.value = saved?.ssid || "";
      if (passwordEl) passwordEl.value = saved?.password || "";

      // set interface if option exists
      if (selectIface && saved?.iface) {
        const opt = Array.from(selectIface.options).find(
          (o) => o.value === saved.iface,
        );
        if (opt) selectIface.value = saved.iface;
      }
    } catch {
      // ignore
    }
  }

  async function startHotspot() {
    if (!deps) return;
    const d = deps as HotspotDeps;
    const {
      withCommandGuard,
      ANIMATION_DELAYS,
      HOTSPOT_SCRIPT,
      runCmdSync,
      ProgressIndicator,
      appendConsole,
      disableAllActions,
      disableSettingsPopup,
      activeCommandId,
      hotspotActive,
      ButtonState,
      prepareActionExecution,
      els,
      rootAccessConfirmed,
      saveHotspotStatus,
      refreshStatus,
      Storage,
      PopupManager,
    } = d;

    await withCommandGuard?.("hotspot-start", async () => {
      // collect settings
      const ifaceEl = els.hotspotIface;
      const ssidEl = els.hotspotSsid;
      const passwordEl = els.hotspotPassword;
      const bandEl = els.hotspotBand;
      const channelEl = els.hotspotChannel;

      const iface = ifaceEl ? String(ifaceEl.value || "").trim() : "";
      const ssid = ssidEl ? String(ssidEl.value || "").trim() : "";
      const password = passwordEl ? String(passwordEl.value || "") : "";
      const band = bandEl ? String(bandEl.value || "") : "2";
      const channel = channelEl ? String(channelEl.value || "") : "";

      const minLen =
        (d as any).APP_CONSTANTS?.HOTSPOT?.PASSWORD_MIN_LENGTH ?? 8;
      if (!iface) {
        appendConsole("Please select a network interface", "err");
        return;
      }
      if (!ssid) {
        appendConsole("Please provide a SSID", "err");
        return;
      }
      if (!password || password.length < minLen) {
        appendConsole(`Password must be at least ${minLen} characters`, "err");
        return;
      }

      // Save settings locally
      try {
        Storage.setJSON("chroot_hotspot_settings", {
          iface,
          ssid,
          password,
          band,
          channel,
        });
      } catch {
        // ignore
      }

      // close popup first
      PopupManager?.close?.(els.hotspotPopup);
      // small delay after closing the popup to let CSS animate out
      await new Promise((r) =>
        setTimeout(r, ANIMATION_DELAYS?.POPUP_CLOSE || 350),
      );

      // Disable UI
      disableAllActions?.(true);
      disableSettingsPopup?.(true);

      const actionText = `Starting hotspot on ${iface}`;
      const prepare = prepareActionExecution
        ? await prepareActionExecution(actionText, actionText, "spinner")
        : null;
      const progressHandle = prepare
        ? { progressLine: prepare.progressLine, interval: prepare.interval }
        : null;

      try {
        const cmdLine = `sh ${HOTSPOT_SCRIPT} start -i "${iface}" -s "${ssid}" -p "${password}" -b "${band}" -c "${channel}" 2>&1`;
        // The script may emit logs - but `runCmdSync` will wait for completion
        const output = await runCmdSync(cmdLine);

        // If runCmdSync returns without throwing, consider success
        appendConsole(`✓ Hotspot started on ${iface}`, "success");

        // Update state
        if (hotspotActive) {
          hotspotActive.value = true;
          saveHotspotStatus?.();
        }
        // Update buttons
        if (ButtonState)
          ButtonState.setButtonPair(
            els.startHotspotBtn,
            els.stopHotspotBtn,
            true,
          );
        // Refresh status
        if (refreshStatus)
          setTimeout(
            () => refreshStatus(),
            ANIMATION_DELAYS?.STATUS_REFRESH || 300,
          );
      } catch (err: any) {
        appendConsole(
          String(err?.message || err || "Failed to start hotspot"),
          "err",
        );
      } finally {
        // remove progress indicator
        if (progressHandle) ProgressIndicator?.remove(progressHandle);
        // Re-enable UI
        disableAllActions?.(false);
        disableSettingsPopup?.(false, true);
      }
    });
  }

  async function stopHotspot() {
    if (!deps) return;
    const d = deps as HotspotDeps;
    const {
      withCommandGuard,
      ANIMATION_DELAYS,
      HOTSPOT_SCRIPT,
      runCmdAsync,
      ProgressIndicator,
      appendConsole,
      disableAllActions,
      disableSettingsPopup,
      activeCommandId,
      hotspotActive,
      saveHotspotStatus,
      ButtonState,
      prepareActionExecution,
      refreshStatus,
      els,
      PopupManager,
    } = d;

    await withCommandGuard?.("hotspot-stop", async () => {
      // Close popup if open
      PopupManager?.close?.(els.hotspotPopup);
      await new Promise((r) =>
        setTimeout(r, ANIMATION_DELAYS?.POPUP_CLOSE || 250),
      );

      disableAllActions?.(true);
      disableSettingsPopup?.(true);

      const actionText = "Stopping hotspot";
      const prepare = prepareActionExecution
        ? await prepareActionExecution(actionText, actionText, "spinner")
        : null;
      const progressHandle = prepare
        ? { progressLine: prepare.progressLine, interval: prepare.interval }
        : null;

      try {
        // Use runCmdAsync in the background to stop ongoing service gracefully
        const cmdLine = `sh ${HOTSPOT_SCRIPT} -k 2>&1`;
        // onComplete callback handles the result
        runCmdAsync?.(cmdLine, (result: any) => {
          // Clean progress indicator
          if (progressHandle) deps!.ProgressIndicator?.remove(progressHandle);
          // Clear state
          if (hotspotActive) {
            hotspotActive.value = false;
            saveHotspotStatus?.();
          }
          if (ButtonState)
            ButtonState.setButtonPair(
              els.startHotspotBtn,
              els.stopHotspotBtn,
              false,
            );

          if (result?.success) {
            appendConsole("✓ Hotspot stopped successfully", "success");
          } else {
            const output = String(result?.output || result?.error || "");
            if (
              output &&
              (output.toLowerCase().includes("warn") ||
                output.toLowerCase().includes("warning"))
            ) {
              appendConsole("⚠ Hotspot stop completed with warnings", "warn");
            } else {
              appendConsole(
                "✗ Failed to stop hotspot (may already be stopped)",
                "warn",
              );
            }
          }

          // Re-enable UI
          disableAllActions?.(false);
          disableSettingsPopup?.(false, true);

          // Refresh status if available
          if (refreshStatus)
            setTimeout(
              () => refreshStatus?.(),
              ANIMATION_DELAYS?.STATUS_REFRESH || 300,
            );
        });
      } catch (err: any) {
        if (progressHandle) deps!.ProgressIndicator?.remove(progressHandle);
        appendConsole(
          `✗ Failed to stop hotspot: ${String(err?.message || err)}`,
          "err",
        );
        disableAllActions?.(false);
        disableSettingsPopup?.(false, true);
      }
    });
  }

  function refreshInterfaces() {
    fetchInterfaces(true, false).catch(() => {});
  }

  // Expose feature's public API
  const API = {
    init,
    fetchInterfaces,
    openHotspotPopup,
    closeHotspotPopup,
    showHotspotWarning,
    dismissHotspotWarning,
    saveHotspotSettings,
    loadHotspotSettings,
    startHotspot,
    stopHotspot,
    refreshInterfaces,
  };

  // Attach to window for compatibility (legacy code depends on it)
  if (typeof window !== "undefined") {
    try {
      (window as any).HotspotFeature = API;
    } catch {
      // ignore attach errors in secure environments
    }
  }

  return API;
})();

export default HotspotFeature;

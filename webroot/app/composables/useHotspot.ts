import { ref } from "vue";
import useConsole from "@/composables/useConsole";
import useNativeCmd from "@/composables/useNativeCmd";
import { Storage } from "@/composables/useStateManager";
import { NetworkInterfaceManager } from "@/services/NetworkInterfaceManager";
import HotspotFeature from "@/features/hotspot";

export function useHotspot(consoleApi: ReturnType<typeof useConsole>) {
  const cmd = useNativeCmd();

  const hotspotWarningVisible = ref<boolean>(true);
  const hotspotIfaces = ref<Array<{ value: string; label: string }>>([]);
  const hotspotIfacesLoading = ref<boolean>(false);
  const hotspotIfaceError = ref<string>("");
  const hotspotIface = ref<string>("");
  const hotspotSsid = ref<string>("");
  const hotspotPassword = ref<string>("");
  const hotspotBand = ref<string>("2");
  const hotspotChannel = ref<string>("6");
  const hotspotChannels = ref<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  const interfaceManager = new NetworkInterfaceManager(
    {
      Storage,
      appendConsole,
      runCmdSync: (cmdStr: string) => cmd.runCommandSync(cmdStr),
      rootAccessConfirmed: cmd.isAvailable,
    },
    "/data/local/ubuntu-chroot/start-hotspot",
    "chroot_hotspot_interfaces_cache",
    null,
    "chroot_hotspot_iface",
    (interfaces: string[]) => {
      hotspotIfaces.value = interfaces
        .map((s: string) => {
          const trimmed = String(s || "").trim();
          if (!trimmed) return null;
          if (trimmed.includes(":")) {
            const parts = trimmed.split(":").map((p) => p.trim());
            return {
              value: parts[0],
              label: `${parts[0]} (${parts[1] || ""})`,
            };
          }
          return { value: trimmed, label: trimmed };
        })
        .filter(Boolean) as Array<{ value: string; label: string }>;
    },
  );

  function appendConsole(text: string, cls?: string) {
    consoleApi.append(text, cls);
  }

  function openHotspotPopup() {
    const el = document.getElementById("hotspot-popup");
    const selectEl = document.getElementById(
      "hotspot-iface",
    ) as HTMLSelectElement | null;

    hotspotIfaceError.value = "";

    interfaceManager.updateSelectElement(selectEl);

    try {
      const cached = Storage.getJSON
        ? Storage.getJSON("chroot_hotspot_interfaces_cache")
        : null;
      if (Array.isArray(cached) && cached.length > 0) {
        hotspotIfaces.value = cached
          .map((s: string) => {
            const trimmed = String(s || "").trim();
            if (!trimmed) return null;
            if (trimmed.includes(":")) {
              const parts = trimmed.split(":").map((p) => p.trim());
              return {
                value: parts[0],
                label: `${parts[0]} (${parts[1] || ""})`,
              };
            }
            return { value: trimmed, label: trimmed };
          })
          .filter(Boolean) as Array<{ value: string; label: string }>;
      }
    } catch (e) {
      // ignore storage read errors
    }

    if (el) el.classList.add("active");

    interfaceManager.fetchInterfaces(false, true).catch(() => {});
    interfaceManager.fetchInterfaces(false, false).catch((err) => {
      hotspotIfaceError.value = "Failed to load interfaces";
    });
  }

  function closeHotspotPopup() {
    const el = document.getElementById("hotspot-popup");
    if (el) el.classList.remove("active");
  }

  async function refreshHotspotIfaces() {
    hotspotIfacesLoading.value = true;
    hotspotIfaceError.value = "";
    try {
      await interfaceManager.fetchInterfaces(true, false);
    } catch (err) {
      hotspotIfaceError.value = "Failed to load interfaces";
    } finally {
      hotspotIfacesLoading.value = false;
    }
  }

  function startHotspot() {
    if (typeof HotspotFeature !== "undefined" && HotspotFeature.startHotspot) {
      HotspotFeature.startHotspot();
    }
  }

  function stopHotspot() {
    if (typeof HotspotFeature !== "undefined" && HotspotFeature.stopHotspot) {
      HotspotFeature.stopHotspot();
    }
  }

  function dismissHotspotWarning() {
    hotspotWarningVisible.value = false;
  }

  function toggleHotspotPassword() {
    const el = document.getElementById(
      "hotspot-password",
    ) as HTMLInputElement | null;
    if (!el) return;
    el.type = el.type === "password" ? "text" : "password";
  }

  return {
    hotspotWarningVisible,
    hotspotIfaces,
    hotspotIfacesLoading,
    hotspotIfaceError,
    hotspotIface,
    hotspotSsid,
    hotspotPassword,
    hotspotBand,
    hotspotChannel,
    hotspotChannels,
    openHotspotPopup,
    closeHotspotPopup,
    refreshHotspotIfaces,
    startHotspot,
    stopHotspot,
    dismissHotspotWarning,
    toggleHotspotPassword,
  };
}

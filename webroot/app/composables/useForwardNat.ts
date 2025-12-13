import { ref } from "vue";
import useConsole from "@/composables/useConsole";
import useNativeCmd from "@/composables/useNativeCmd";
import { Storage } from "@/composables/useStateManager";
import { NetworkInterfaceManager } from "@/services/NetworkInterfaceManager";
import ForwardNatFeature from "@/features/forward-nat";

export function useForwardNat(consoleApi: ReturnType<typeof useConsole>) {
  const cmd = useNativeCmd();

  function appendConsole(text: string, cls?: string) {
    consoleApi.append(text, cls);
  }
  const forwardNatIfaces = ref<Array<{ value: string; label: string }>>([]);
  const forwardNatIface = ref<string>("");

  const interfaceManager = new NetworkInterfaceManager(
    {
      Storage,
      appendConsole,
      runCmdSync: (cmdStr: string) => cmd.runCommandSync(cmdStr),
      rootAccessConfirmed: cmd.isAvailable,
    },
    "/data/local/ubuntu-chroot/forward-nat.sh",
    "chroot_forward_nat_interfaces_cache",
    null,
    "chroot_selected_interface",
    (interfaces: string[]) => {
      forwardNatIfaces.value = interfaces
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

  function openForwardNatPopup() {
    const el = document.getElementById("forward-nat-popup");
    const selectEl = document.getElementById(
      "forward-nat-iface",
    ) as HTMLSelectElement | null;

    interfaceManager.updateSelectElement(selectEl);

    if (el) el.classList.add("active");

    interfaceManager.fetchInterfaces(false, true).catch(() => {});
    interfaceManager.fetchInterfaces(false, false).catch(() => {});
  }

  function closeForwardNatPopup() {
    const el = document.getElementById("forward-nat-popup");
    if (el) el.classList.remove("active");
  }

  function startForwarding() {
    if (
      typeof ForwardNatFeature !== "undefined" &&
      ForwardNatFeature.startForwarding
    ) {
      ForwardNatFeature.startForwarding();
    } else {
      appendConsole("No forwarding implementation available", "warn");
    }
  }

  function stopForwarding() {
    if (
      typeof ForwardNatFeature !== "undefined" &&
      ForwardNatFeature.stopForwarding
    ) {
      ForwardNatFeature.stopForwarding();
    } else {
      appendConsole("No forwarding implementation available", "warn");
    }
  }

  return {
    forwardNatIfaces,
    forwardNatIface,
    openForwardNatPopup,
    closeForwardNatPopup,
    startForwarding,
    stopForwarding,
  };
}

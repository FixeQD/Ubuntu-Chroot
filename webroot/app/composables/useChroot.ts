import { ref, computed } from "vue";
import useNativeCmd from "@/composables/useNativeCmd";
import useConsole from "@/composables/useConsole";
import { Storage, StateManager } from "@/composables/useStateManager";
import ProgressIndicator from "@/services/progressIndicator";
import {
  CHROOT_DIR,
  PATH_CHROOT_SH,
  OTA_UPDATER,
  BOOT_FILE,
  DOZE_OFF_FILE,
} from "@/composables/constants";

export function useChroot() {
  const cmd = useNativeCmd();
  const consoleApi = useConsole();
  const consoleRef = consoleApi.consoleRef;

  const statusText = ref<string>("unknown");
  const startDisabled = ref<boolean>(true);
  const stopDisabled = ref<boolean>(true);
  const restartDisabled = ref<boolean>(true);
  const userSelectDisabled = ref<boolean>(true);
  const copyLoginDisabled = ref<boolean>(true);

  const users = ref<string[]>([]);
  const selectedUser = ref<string>("root");

  const runAtBoot = ref<boolean>(false);
  const debugMode = ref<boolean>(StateManager.get("debug"));
  const androidOptimize = ref<boolean>(true);

  const postExecScript = ref<string>("");

  const activeCommandId = ref<string | null>(null);

  const rootAccessConfirmedRef = ref<boolean>(cmd.isAvailable.value);

  const statusDotClass = computed(() => {
    switch (statusText.value) {
      case "running":
        return "dot dot-on";
      case "stopped":
        return "dot dot-off";
      case "starting":
        return "dot dot-on";
      case "stopping":
        return "dot dot-off";
      case "not_found":
        return "dot dot-off";
      default:
        return "dot dot-unknown";
    }
  });

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

  async function fetchUsers(silent = false) {
    if (!cmd.isAvailable.value) return;
    try {
      const out = await cmd.runCommandSync(`sh ${PATH_CHROOT_SH} list-users`);
      const list = String(out || "").trim();
      users.value = list ? list.split(",").filter(Boolean) : [];
      const saved = Storage.get("chroot_selected_user");
      if (saved && users.value.includes(saved)) selectedUser.value = saved;
      if (!silent)
        appendConsole(
          `Found ${users.value.length} regular user(s) in chroot`,
          "info",
        );
    } catch (e: any) {
      if (!silent)
        appendConsole(
          `Could not fetch users from chroot: ${e.message}`,
          "warn",
        );
      users.value = [];
    }
  }

  async function copyLoginCommand() {
    const user = selectedUser.value || "root";
    Storage.set("chroot_selected_user", user);

    let chrootCmd = "ubuntu-chroot";
    try {
      const check = await cmd.runCommandSync(
        'command -v ubuntu-chroot 2>/dev/null || echo ""',
      );
      if (!String(check || "").trim()) {
        chrootCmd = `sh ${PATH_CHROOT_SH}`;
      }
    } catch {
      chrootCmd = `sh ${PATH_CHROOT_SH}`;
    }

    const loginCommand = `su -c "${chrootCmd} start ${user} -s"`;
    try {
      await navigator.clipboard.writeText(loginCommand);
      appendConsole(`Login command for user '${user}' copied to clipboard`);
    } catch {
      appendConsole(loginCommand);
    }
  }

  async function checkRootAccess(silent = false) {
    if (!cmd.isAvailable.value) {
      if (!silent)
        appendConsole(
          "No root bridge detected — running offline. Actions disabled.",
        );
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
      return false;
    }
    try {
      await cmd.runCommandSync('echo "test"');
      if (!silent) appendConsole("Root access available", "info");
      return true;
    } catch (e: any) {
      if (!silent)
        appendConsole(
          `Failed to detect root execution method: ${e.message}`,
          "err",
        );
      return false;
    }
  }

  async function refreshStatus() {
    const root = await checkRootAccess(true);
    if (!root) {
      statusText.value = "unknown";
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
      return;
    }

    try {
      const out = await cmd.runCommandSync(`sh ${PATH_CHROOT_SH} status`);
      appendConsole(`[DEBUG] raw status output: ${String(out || "")}`, "debug");
      const s = String(out || "");
      const running = /Status:\s*RUNNING/i.test(s);

      if (running) {
        statusText.value = "running";
        startDisabled.value = true;
        stopDisabled.value = false;
        restartDisabled.value = false;
        userSelectDisabled.value = false;
        copyLoginDisabled.value = false;
        appendConsole("[DEBUG] UI set to running", "debug");
      } else {
        const chrootExists = !(String(s || "").trim() === "");
        if (!chrootExists) {
          statusText.value = "not_found";
          startDisabled.value = true;
          stopDisabled.value = true;
          restartDisabled.value = true;
          userSelectDisabled.value = true;
          copyLoginDisabled.value = true;
          appendConsole("[DEBUG] UI set to not_found", "debug");
        } else {
          statusText.value = "stopped";
          startDisabled.value = false;
          stopDisabled.value = true;
          restartDisabled.value = true;
          userSelectDisabled.value = true;
          copyLoginDisabled.value = true;
          appendConsole("[DEBUG] UI set to stopped", "debug");
        }
      }
    } catch (e: any) {
      statusText.value = "unknown";
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
      appendConsole(`Failed to get status: ${e.message}`, "warn");
    }
  }

  /**
   * Update the overall UI status and button states in a single place.
   * Accepts the same status strings used elsewhere (running, stopped, starting, stopping, not_found, updating, etc).
   */
  function updateStatus(state: string) {
    // Normalize incoming string
    const s = String(state || "").trim();

    if (s === "running") {
      statusText.value = "running";
      startDisabled.value = true;
      stopDisabled.value = false;
      restartDisabled.value = false;
      userSelectDisabled.value = false;
      copyLoginDisabled.value = false;
    } else if (s === "stopped") {
      statusText.value = "stopped";
      startDisabled.value = false;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
    } else if (s === "starting" || s === "stopping" || s === "restarting") {
      // Transition states - treat them as in-progress and disable main actions
      statusText.value = s;
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
    } else if (
      s === "backing up" ||
      s === "restoring" ||
      s === "migrating" ||
      s === "uninstalling" ||
      s === "updating" ||
      s === "trimming" ||
      s === "resizing"
    ) {
      // Long-running maintenance operations - disable control actions
      statusText.value = s;
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
    } else if (s === "not_found") {
      statusText.value = "not_found";
      startDisabled.value = true; // no chroot to start
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
    } else {
      // Unknown fallback
      statusText.value = s || "unknown";
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
    }
  }

  async function refreshStatusManual() {
    try {
      const rootOK = await checkRootAccess(true);
      if (rootOK) {
        await refreshStatus();
        await fetchUsers(true);
      }
      await readBootFile(true);
      await readDozeOffFile(true);
    } catch (e) {
      appendConsole("Refresh failed", "warn");
    }
  }

  async function doAction(action: "start" | "stop" | "restart") {
    if (!cmd.isAvailable.value) {
      appendConsole("Cannot execute commands: backend unavailable", "err");
      return;
    }

    await consoleApi.scrollToBottom({ behavior: "smooth", waitMs: 200 });
    const actionText =
      action === "start"
        ? "Starting chroot"
        : action === "stop"
          ? "Stopping chroot"
          : "Restarting chroot";
    const progress = ProgressIndicator.create(
      actionText,
      "dots",
      consoleRef || document.getElementById("console"),
    );

    try {
      const cmdStr = `sh ${PATH_CHROOT_SH} ${action} --no-shell`;
      const result = await cmd.runCommandAsyncPromise(cmdStr, {
        asRoot: true,
        debug: debugMode.value,
      });
      if (result.success) {
        appendConsole(`✓ ${action} completed successfully`, "success");
        await refreshStatus();
      } else {
        appendConsole(
          `✗ ${action} failed: ${result.error || "Unknown error"}`,
          "err",
        );
      }
    } catch (e: any) {
      appendConsole(`✗ ${action} failed: ${e?.message || String(e)}`, "err");
    } finally {
      ProgressIndicator.remove(progress);
    }
  }

  async function start() {
    await doAction("start");
  }
  async function stop() {
    await doAction("stop");
  }
  async function restart() {
    await doAction("restart");
  }

  async function readBootFile(silent = false) {
    try {
      const out = await cmd.runCommandSync(
        `cat ${BOOT_FILE} 2>/dev/null || echo 0`,
      );
      runAtBoot.value = String(out || "").trim() === "1";
      if (!silent)
        appendConsole(
          `Run-at-boot: ${runAtBoot.value ? "enabled" : "disabled"}`,
          "info",
        );
    } catch {
      runAtBoot.value = false;
    }
  }

  async function writeBootFile() {
    try {
      await cmd.runCommandSync(
        `mkdir -p ${CHROOT_DIR} && echo ${runAtBoot.value ? 1 : 0} > ${BOOT_FILE}`,
      );
      appendConsole(
        `Run-at-boot ${runAtBoot.value ? "enabled" : "disabled"}`,
        "success",
      );
    } catch (e: any) {
      appendConsole(`✗ Failed to set run-at-boot: ${e.message}`, "err");
      await readBootFile(true);
    }
  }

  function toggleBoot() {
    writeBootFile();
  }

  async function readDozeOffFile(silent = false) {
    try {
      const out = await cmd.runCommandSync(
        `cat ${DOZE_OFF_FILE} 2>/dev/null || echo 1`,
      );
      androidOptimize.value = String(out || "").trim() === "1";
      if (!silent)
        appendConsole(
          `Android optimizations: ${androidOptimize.value ? "enabled" : "disabled"}`,
          "info",
        );
    } catch {
      androidOptimize.value = true;
    }
  }

  async function writeDozeOffFile() {
    try {
      await cmd.runCommandSync(
        `mkdir -p ${CHROOT_DIR} && echo ${androidOptimize.value ? 1 : 0} > ${DOZE_OFF_FILE}`,
      );
      appendConsole(
        `Android optimizations ${androidOptimize.value ? "enabled" : "disabled"}`,
        "success",
      );
    } catch (e: any) {
      appendConsole(
        `✗ Failed to set Android optimizations: ${e.message}`,
        "err",
      );
      await readDozeOffFile(true);
    }
  }

  async function loadPostExecScript() {
    try {
      const out = await cmd.runCommandSync(
        `cat ${CHROOT_DIR}/post_exec.sh 2>/dev/null || echo ''`,
      );
      postExecScript.value = String(out || "").trim();
    } catch (e) {
      appendConsole(`Failed to load post-exec script: ${String(e)}`, "warn");
      postExecScript.value = "";
    }
  }

  async function savePostExecScript() {
    try {
      // encode as base64 safely
      const utf8 = new TextEncoder().encode(postExecScript.value || "");
      let binary = "";
      for (let i = 0; i < utf8.length; i += 8192) {
        const slice = utf8.subarray(i, i + 8192);
        binary += String.fromCharCode.apply(null, Array.from(slice));
      }
      const base64 = btoa(binary);
      await cmd.runCommandSync(
        `echo '${base64}' | base64 -d > ${CHROOT_DIR}/post_exec.sh`,
      );
      await cmd.runCommandSync(`chmod 755 ${CHROOT_DIR}/post_exec.sh`);
      appendConsole("Post-exec script saved successfully", "success");
    } catch (e: any) {
      appendConsole(`Failed to save post-exec script: ${e.message}`, "err");
    }
  }

  async function clearPostExecScript() {
    postExecScript.value = "";
    try {
      await cmd.runCommandSync(`echo '' > ${CHROOT_DIR}/post_exec.sh`);
      appendConsole("Post-exec script cleared successfully", "info");
    } catch (e: any) {
      appendConsole(`Failed to clear post-exec script: ${e.message}`, "err");
    }
  }

  async function updateChroot(closeSettingsPopup: () => void) {
    if (!(await checkRootAccess(true))) {
      appendConsole("Cannot update chroot: root access not available", "err");
      return;
    }

    const confirmed = confirm(
      "Update Chroot Environment",
      "This will apply any available updates to the chroot environment.\n\nThe chroot will be started if it's not running. Continue?",
      "Update",
      "Cancel",
    );

    if (!confirmed) return;

    closeSettingsPopup();

    statusText.value = "updating";

    try {
      if (statusText.value !== "running") {
        await start();
        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const cmdStr = `sh ${OTA_UPDATER}`;
      const result = await cmd.runCommandAsyncPromise(cmdStr, {
        asRoot: true,
        debug: debugMode.value,
      });

      if (result.success) {
        appendConsole("✓ Chroot update completed successfully", "success");

        await restart();

        appendConsole("━━━ Update Complete ━━━", "success");
      } else {
        appendConsole("✗ Chroot update failed", "err");
      }
    } catch (e: any) {
      appendConsole(`✗ Update failed: ${e?.message || String(e)}`, "err");
    } finally {
      await refreshStatus();
    }
  }

  return {
    statusText,
    startDisabled,
    stopDisabled,
    restartDisabled,
    userSelectDisabled,
    copyLoginDisabled,
    users,
    selectedUser,
    runAtBoot,
    debugMode,
    androidOptimize,
    postExecScript,
    activeCommandId,
    rootAccessConfirmedRef,
    statusDotClass,
    appendConsole,
    withCommandGuard,
    fetchUsers,
    copyLoginCommand,
    checkRootAccess,
    refreshStatus,
    updateStatus,
    refreshStatusManual,
    doAction,
    start,
    stop,
    restart,
    readBootFile,
    writeBootFile,
    toggleBoot,
    readDozeOffFile,
    writeDozeOffFile,
    loadPostExecScript,
    savePostExecScript,
    clearPostExecScript,
    updateChroot,
  };
}

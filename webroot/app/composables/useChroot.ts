import { ref, computed, nextTick } from "vue";
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

export function useChroot(consoleApi: ReturnType<typeof useConsole>) {
  const cmd = useNativeCmd();
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
  const showProgress = ref<boolean>(false);
  const progressType = ref<"backup" | "restore" | null>(null);

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
    if (cls === "debug" && !debugMode.value) return;
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
      const out = await cmd.runCommandSync(`${PATH_CHROOT_SH} list-users`);
      const list = String(out || "").trim();
      users.value = list ? list.split(",").filter(Boolean) : [];
      const saved = Storage.get("chroot_selected_user");
      if (saved && users.value.includes(saved)) selectedUser.value = saved;
      if (!silent)
        appendConsole(
          `Found ${users.value.length} regular user(s) in chroot`,
          "info",
        );
    } catch (e: unknown) {
      if (!silent)
        appendConsole(
          `Could not fetch users from chroot: ${String(e)}`,
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
      const result = await cmd.runCommandAsyncPromise(
        'command -v ubuntu-chroot 2>/dev/null || echo ""',
      );
      if (!String(result.output || "").trim()) {
        chrootCmd = `${PATH_CHROOT_SH}`;
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
      const result = await cmd.runCommandAsyncPromise('echo "test"');
      if (result.success) {
        if (!silent) appendConsole("Root access available", "info");
        return true;
      } else {
        if (!silent)
          appendConsole(
            `Failed to detect root execution method: ${result.error || "Unknown error"}`,
            "err",
          );
        return false;
      }
    } catch (e: unknown) {
      if (!silent)
        appendConsole(
          `Failed to detect root execution method: ${String(e)}`,
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
      const out = await cmd.runCommandSync(`${PATH_CHROOT_SH} raw-status`);
      const s = String(out || "")
        .trim()
        .toUpperCase();

      if (s === "RUNNING") {
        console.log("Setting statusText to running");
        statusText.value = "running";
        startDisabled.value = true;
        stopDisabled.value = false;
        restartDisabled.value = false;
        userSelectDisabled.value = false;
        copyLoginDisabled.value = false;
      } else if (s === "STOPPED") {
        console.log("Setting statusText to stopped");
        statusText.value = "stopped";
        startDisabled.value = false;
        stopDisabled.value = true;
        restartDisabled.value = true;
        userSelectDisabled.value = true;
        copyLoginDisabled.value = true;
      } else {
        statusText.value = "unknown";
        startDisabled.value = true;
        stopDisabled.value = true;
        restartDisabled.value = true;
        userSelectDisabled.value = true;
        copyLoginDisabled.value = true;
      }
    } catch (e: unknown) {
      statusText.value = "unknown";
      startDisabled.value = true;
      stopDisabled.value = true;
      restartDisabled.value = true;
      userSelectDisabled.value = true;
      copyLoginDisabled.value = true;
      appendConsole(`Failed to get status: ${String(e)}`, "warn");
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

    await withCommandGuard(action, async () => {
      updateStatus(
        action === "start"
          ? "starting"
          : action === "stop"
            ? "stopping"
            : "restarting",
      );

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const actionText =
        action === "start"
          ? "Starting chroot"
          : action === "stop"
            ? "Stopping chroot"
            : "Restarting chroot";
      const progress = ProgressIndicator.create(
        actionText,
        "dots",
        consoleRef.value || document.getElementById("console"),
      );

      consoleApi
        .scrollToBottom({ behavior: "smooth", waitMs: 400 })
        .catch(() => {});

      const cmdStr = `${PATH_CHROOT_SH} ${action} --no-shell`;
      console.log(`Running command: ${cmdStr}`);
      try {
        const result = await cmd.runCommandAsyncPromise(cmdStr, {
          asRoot: true,
          debug: debugMode.value,
          onOutput: (line: string) => appendConsole(line),
        });
        if (result.success) {
          appendConsole(`✓ ${action} completed successfully`, "success");
          await refreshStatus();
        } else {
          appendConsole(
            `✗ ${action} failed: ${result.error || "Unknown error"}`,
            "err",
          );
          await refreshStatus();
        }
      } catch (e: unknown) {
        appendConsole(`Failed to execute ${action}: ${String(e)}`, "err");
        await refreshStatus();
      } finally {
        ProgressIndicator.remove(progress);
      }
    });
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
      const result = await cmd.runCommandAsyncPromise(
        `cat ${BOOT_FILE} 2>/dev/null || echo 0`,
      );
      runAtBoot.value = String(result.output || "").trim() === "1";
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
      const result = await cmd.runCommandAsyncPromise(
        `mkdir -p ${CHROOT_DIR} && echo ${runAtBoot.value ? 1 : 0} > ${BOOT_FILE}`,
      );
      if (result.success) {
        appendConsole(
          `Run-at-boot ${runAtBoot.value ? "enabled" : "disabled"}`,
          "success",
        );
      } else {
        appendConsole(
          `✗ Failed to set run-at-boot: ${result.error || "Unknown error"}`,
          "err",
        );
        await readBootFile(true);
      }
    } catch (e: unknown) {
      appendConsole(`✗ Failed to set run-at-boot: ${String(e)}`, "err");
      await readBootFile(true);
    }
  }

  function toggleBoot() {
    writeBootFile();
  }

  async function readDozeOffFile(silent = false) {
    try {
      const result = await cmd.runCommandAsyncPromise(
        `cat ${DOZE_OFF_FILE} 2>/dev/null || echo 1`,
      );
      androidOptimize.value = String(result.output || "").trim() === "1";
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
      const result = await cmd.runCommandAsyncPromise(
        `mkdir -p ${CHROOT_DIR} && echo ${androidOptimize.value ? 1 : 0} > ${DOZE_OFF_FILE}`,
      );
      if (result.success) {
        appendConsole(
          `Android optimizations ${androidOptimize.value ? "enabled" : "disabled"}`,
          "success",
        );
      } else {
        appendConsole(
          `✗ Failed to set Android optimizations: ${result.error || "Unknown error"}`,
          "err",
        );
        await readDozeOffFile(true);
      }
    } catch (e: unknown) {
      appendConsole(
        `✗ Failed to set Android optimizations: ${String(e)}`,
        "err",
      );
      await readDozeOffFile(true);
    }
  }

  async function loadPostExecScript() {
    try {
      const result = await cmd.runCommandAsyncPromise(
        `cat ${CHROOT_DIR}/post_exec.sh 2>/dev/null || echo ''`,
      );
      postExecScript.value = String(result.output || "").trim();
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
      const result1 = await cmd.runCommandAsyncPromise(
        `echo '${base64}' | base64 -d > ${CHROOT_DIR}/post_exec.sh`,
      );
      if (!result1.success) {
        appendConsole(
          `Failed to save post-exec script: ${result1.error || "Unknown error"}`,
          "err",
        );
        return;
      }
      const result2 = await cmd.runCommandAsyncPromise(
        `chmod 755 ${CHROOT_DIR}/post_exec.sh`,
      );
      if (result2.success) {
        appendConsole("Post-exec script saved successfully", "success");
      } else {
        appendConsole(
          `Failed to set permissions: ${result2.error || "Unknown error"}`,
          "err",
        );
      }
    } catch (e: unknown) {
      appendConsole(`Failed to save post-exec script: ${String(e)}`, "err");
    }
  }

  async function clearPostExecScript() {
    postExecScript.value = "";
    try {
      const result = await cmd.runCommandAsyncPromise(
        `echo '' > ${CHROOT_DIR}/post_exec.sh`,
      );
      if (result.success) {
        appendConsole("Post-exec script cleared successfully", "info");
      } else {
        appendConsole(
          `Failed to clear post-exec script: ${result.error || "Unknown error"}`,
          "err",
        );
      }
    } catch (e: unknown) {
      appendConsole(`Failed to clear post-exec script: ${String(e)}`, "err");
    }
  }

  async function updateChroot(closeSettingsPopup: () => void) {
    if (!(await checkRootAccess(true))) {
      appendConsole("Cannot update chroot: root access not available", "err");
      return;
    }

    const confirmed = window.confirm(
      "Update Chroot Environment\n\nThis will apply any available updates to the chroot environment.\n\nThe chroot will be started if it's not running. Continue?",
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

      const cmdStr = `${OTA_UPDATER}`;
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
    } catch (e: unknown) {
      appendConsole(`✗ Update failed: ${String(e)}`, "err");
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
    showProgress,
    progressType,
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

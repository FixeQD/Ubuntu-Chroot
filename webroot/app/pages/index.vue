<template>
  <LoadingScreen v-if="showLoading" />
  <div class="app">
    <Header
      :onBeforeOpenSettings="() => loadPostExecScript()"
      @openForwardNatPopup="openForwardNatPopup"
      @openHotspotPopup="openHotspotPopup"
      @openSettingsPopup="openSettingsPopup"
    />

    <main class="panel">
      <StatusSection
        :statusText="statusText"
        :startDisabled="startDisabled"
        :stopDisabled="stopDisabled"
        :restartDisabled="restartDisabled"
        :debugMode="debugMode"
        @start="start"
        @stop="stop"
        @restart="restart"
      />

      <UserSection
        :users="users"
        :selectedUser="selectedUser"
        :userSelectDisabled="userSelectDisabled"
        :copyLoginDisabled="copyLoginDisabled"
        :runAtBoot="runAtBoot"
        @update:selectedUser="selectedUser = $event"
        @update:runAtBoot="runAtBoot = $event"
        @copyLoginCommand="copyLoginCommand"
      />

      <ConsoleSection
        :logBuffer="consoleApi"
        @refreshStatusManual="refreshStatusManual"
      />
    </main>

    <SettingsPopup
      :postExecScript="postExecScript"
      :debugMode="debugMode"
      :androidOptimize="androidOptimize"
      @close="closeSettingsPopup"
      @update:postExecScript="postExecScript = $event"
      @update:debugMode="debugMode = $event"
      @update:androidOptimize="androidOptimize = $event"
      @savePostExecScript="savePostExecScript"
      @clearPostExecScript="clearPostExecScript"
      @updateChroot="() => updateChroot(closeSettingsPopup)"
      @backupChroot="backupChroot"
      @restoreChroot="restoreChroot"
      @uninstallChroot="uninstallChroot"
    />

    <SparseSettingsPopup
      @close="closeSparseSettingsPopup"
      @trimSparseImage="trimSparseImage"
      @resizeSparseImage="resizeSparseImage"
    />

    <HotspotPopup
      :hotspotWarningVisible="hotspotWarningVisible"
      :hotspotIfaces="hotspotIfaces"
      :hotspotLoading="hotspotIfacesLoading"
      :hotspotIfaceError="hotspotIfaceError"
      :hotspotIface="hotspotIface"
      :hotspotSsid="hotspotSsid"
      :hotspotPassword="hotspotPassword"
      :hotspotBand="hotspotBand"
      :hotspotChannel="hotspotChannel"
      :hotspotChannels="hotspotChannels"
      @close="closeHotspotPopup"
      @dismissHotspotWarning="dismissHotspotWarning"
      @update:hotspotIface="hotspotIface = $event"
      @update:hotspotSsid="hotspotSsid = $event"
      @update:hotspotPassword="hotspotPassword = $event"
      @update:hotspotBand="hotspotBand = $event"
      @update:hotspotChannel="hotspotChannel = $event"
      @toggleHotspotPassword="toggleHotspotPassword"
      @startHotspot="startHotspot"
      @stopHotspot="stopHotspot"
      @refreshHotspotIfaces="refreshHotspotIfaces"
    />

    <ForwardNatPopup
      :forwardNatIfaces="forwardNatIfaces"
      :forwardNatIface="forwardNatIface"
      @close="closeForwardNatPopup"
      @update:forwardNatIface="forwardNatIface = $event"
      @startForwarding="startForwarding"
      @stopForwarding="stopForwarding"
    />

    <Footer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import useNativeCmd from "@/composables/useNativeCmd";
import useConsole from "@/composables/useConsole";
import { Storage, StateManager } from "@/composables/useStateManager";
import ProgressIndicator from "@/services/progressIndicator";
import Header from "@/components/Header.vue";
import StatusSection from "@/components/StatusSection.vue";
import UserSection from "@/components/UserSection.vue";
import ConsoleSection from "@/components/ConsoleSection.vue";
import SettingsPopup from "@/components/SettingsPopup.vue";
import SparseSettingsPopup from "@/components/SparseSettingsPopup.vue";
import HotspotPopup from "@/components/HotspotPopup.vue";
import ForwardNatPopup from "@/components/ForwardNatPopup.vue";
import Footer from "@/components/Footer.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import HotspotFeature from "@/features/hotspot";
import ForwardNatFeature from "@/features/forward-nat";
import BackupRestoreFeature from "@/features/backup-restore";
import UninstallFeature from "@/features/uninstall";
import ResizeFeature from "@/features/resize";
import MigrateFeature from "@/features/migrate";
import { useChroot } from "@/composables/useChroot";
import { useHotspot } from "@/composables/useHotspot";
import { useForwardNat } from "@/composables/useForwardNat";
import { useSettings } from "@/composables/useSettings";
import { useFeatures } from "@/composables/useFeatures";
import { ROOTFS_DIR } from "@/composables/constants";

const cmd = useNativeCmd();
const consoleApi = useConsole();
const showLoading = ref(true);

const {
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
} = useChroot(consoleApi);

const {
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
} = useHotspot(consoleApi);

const {
  forwardNatIfaces,
  forwardNatIface,
  openForwardNatPopup,
  closeForwardNatPopup,
  startForwarding,
  stopForwarding,
} = useForwardNat(consoleApi);

const {
  openSettingsPopup,
  closeSettingsPopup,
  openSparseSettingsPopup,
  closeSparseSettingsPopup,
  backupChroot,
  restoreChroot,
  uninstallChroot,
  trimSparseImage,
  resizeSparseImage,
} = useSettings(consoleApi);

const { copyConsole, clearConsole, initFeatureModules } = useFeatures(
  updateStatus,
  refreshStatus,
  consoleApi,
);

watch(
  () => cmd.isAvailable.value,
  (val) => {
    rootAccessConfirmedRef.value = val;
  },
);

watch(
  () => cmd.isAvailable.value,
  async (avail) => {
    if (!avail) return;
    try {
      const rootOK = await checkRootAccess();
      if (rootOK) {
        await Promise.all([refreshStatus(), fetchUsers()]);
      }

      await Promise.all([
        readBootFile(true).catch(() => {}),
        readDozeOffFile(true).catch(() => {}),
        (async () => {
          try {
            if (
              typeof HotspotFeature !== "undefined" &&
              HotspotFeature.fetchInterfaces
            ) {
              await HotspotFeature.fetchInterfaces(false, true).catch(() => {});
            }
          } catch {}
        })(),
        (async () => {
          try {
            if (
              typeof ForwardNatFeature !== "undefined" &&
              ForwardNatFeature.fetchInterfaces
            ) {
              await ForwardNatFeature.fetchInterfaces(false, true).catch(() => {});
            }
          } catch {}
        })(),
      ]);
    } catch (e) {
      appendConsole(`Delayed root check failed: ${String(e)}`, "warn");
    }
  },
);

watch(debugMode, (val) => {
  StateManager.set("debug", val);
  appendConsole(val ? "Debug mode enabled" : "Debug mode disabled", "info");
});

watch(androidOptimize, (val) => {
  writeDozeOffFile();
});

watch(runAtBoot, (val) => {
  writeBootFile(val);
});

onMounted(async () => {
  // Check if ROOTFS_DIR exists
  const check = await cmd.runCommandSync(`ls -ld ${ROOTFS_DIR} 2>&1`);
  const result = String(check || "").trim();
  if (result.includes("No such file or directory")) {
    navigateTo("/not-found");
    return;
  }

  updateStatus("unknown");
  // bind & load console now handled by composable
  try {
    const overlayCount = document.querySelectorAll(
      ".popup-overlay.active",
    ).length;
    appendConsole(`DEBUG: popup-overlay active count=${overlayCount}`, "debug");
  } catch (e) {
    // best-effort only
  }

  const rootOK = await checkRootAccess();
  if (rootOK) {
    await Promise.all([refreshStatus(), fetchUsers()]);
  }
  await Promise.all([
    readBootFile(true).catch(() => {}),
    readDozeOffFile(true).catch(() => {}),
  ]);

  initFeatureModules();
  setTimeout(() => {
    try {
      if (
        typeof HotspotFeature !== "undefined" &&
        HotspotFeature.fetchInterfaces
      ) {
        HotspotFeature.fetchInterfaces(false, true).catch(() => {});
      }
    } catch {}
    try {
      if (
        typeof ForwardNatFeature !== "undefined" &&
        ForwardNatFeature.fetchInterfaces
      ) {
        ForwardNatFeature.fetchInterfaces(false, true).catch(() => {});
      }
    } catch {}
  }, 250);

  showLoading.value = false;
});
</script>

<style scoped></style>

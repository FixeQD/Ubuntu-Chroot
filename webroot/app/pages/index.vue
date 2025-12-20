<template>
  <LoadingScreen v-if="showLoading" />
  <NotFound v-if="showNotFound" @retry="handleRetry" />
  <ProgressPopup
    :visible="showProgress"
    :title="progressTitle"
    :message="progressMessage"
  />
  <div v-if="!showLoading && !showNotFound" class="app">
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
      :disabled="globalDisabled"
      @close="closeSettingsPopup"
      @update:postExecScript="postExecScript = $event"
      @update:debugMode="debugMode = $event"
      @update:androidOptimize="androidOptimize = $event"
      @savePostExecScript="savePostExecScript"
      @clearPostExecScript="clearPostExecScript"
      @updateChroot="() => updateChroot(closeSettingsPopup)"
      @backupChroot="backupChroot"
      @restoreChroot="restoreChroot"
      @uninstallChroot="handleUninstallConfirm"
    />

    <SparseSettingsPopup
      :disabled="globalDisabled"
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
      :disabled="globalDisabled"
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
      :disabled="globalDisabled"
      @close="closeForwardNatPopup"
      @update:forwardNatIface="forwardNatIface = $event"
      @startForwarding="startForwarding"
      @stopForwarding="stopForwarding"
    />

    <UpdateConfirmPopup
      :visible="showUpdateConfirm"
      @confirm="confirmUpdate(closeSettingsPopup)"
      @cancel="showUpdateConfirm = false"
    />

    <UninstallConfirmPopup
      :visible="showUninstallConfirm"
      @confirm="confirmUninstall"
      @cancel="showUninstallConfirm = false"
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
import UpdateConfirmPopup from "@/components/UpdateConfirmPopup.vue";
import UninstallConfirmPopup from "@/components/UninstallConfirmPopup.vue";
import Footer from "@/components/Footer.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import ProgressPopup from "@/components/ProgressPopup.vue";
import NotFound from "@/components/NotFound.vue";
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
import { ROOTFS_DIR, PATH_CHROOT_SH } from "@/composables/constants";

const cmd = useNativeCmd();
const consoleApi = useConsole();
const showLoading = ref(true);
const showNotFound = ref(false);
const showUninstallConfirm = ref(false);
const globalDisabled = computed(() => !!activeCommandId.value);

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
  showProgress,
  progressTitle,
  progressMessage,
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
  showUpdateConfirm,
  confirmUpdate,
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
  showProgress,
  progressTitle,
  progressMessage,
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
              await ForwardNatFeature.fetchInterfaces(false, true).catch(
                () => {},
              );
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

const performCheck = async () => {
  // Check if chroot exists
  const check = await cmd.runCommandSync(`sh ${PATH_CHROOT_SH} check_existing`);
  const result = String(check || "").trim();
  if (result !== "exists") {
    showNotFound.value = true;
    showLoading.value = false;
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

  // Fallback timeout to prevent hanging loading screen
  setTimeout(() => {
    showLoading.value = false;
  }, 10000);

  showLoading.value = false;
};

const handleRetry = () => {
  showNotFound.value = false;
  showLoading.value = true;
  performCheck();
};

const handleUninstallConfirm = () => {
  showUninstallConfirm.value = true;
};

const confirmUninstall = () => {
  showUninstallConfirm.value = false;
  uninstallChroot();
};

onMounted(async () => {
  await performCheck();
});
</script>

<style scoped></style>

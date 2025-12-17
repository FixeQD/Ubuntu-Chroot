<template>
  <div id="settings-popup" class="popup-overlay" ref="popupRef">
    <div class="popup-content">
      <div class="popup-header">
        <h3>Options</h3>
        <button
          id="close-popup"
          class="close-btn"
          title="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
      <div class="popup-body">
        <div class="setting-section">
          <h4>Post-exec Script</h4>
          <p class="setting-desc">Commands to run after chroot starts</p>
          <textarea
            id="post-exec-script"
            class="script-editor"
            :value="postExecScript"
            :readonly="disabled"
            @input="$emit('update:postExecScript', $event.target.value)"
            placeholder="echo 'Chroot started successfully'\n# Add your commands here"
            rows="6"
          ></textarea>
          <div class="script-actions">
            <button
              id="save-script"
              class="btn small"
              :disabled="disabled"
              @click="$emit('savePostExecScript')"
            >
              Save
            </button>
            <button
              id="clear-script"
              class="btn outline small"
              :disabled="disabled"
              @click="$emit('clearPostExecScript')"
            >
              Clear
            </button>
          </div>
        </div>

        <div class="setting-section">
          <h4>Update Chroot</h4>
          <p class="setting-desc">
            Apply incremental updates to the chroot environment
          </p>
          <button
            id="update-btn"
            class="btn"
            :disabled="disabled"
            @click="$emit('updateChroot')"
          >
            Update Chroot
          </button>
        </div>

        <div class="setting-section">
          <h4>Backup & Restore</h4>
          <p class="setting-desc">
            Create backups of your chroot environment or restore from previous
            backups
          </p>
          <div class="script-actions">
            <button
              id="backup-btn"
              class="btn"
              :disabled="disabled"
              @click="$emit('backupChroot')"
            >
              Backup Chroot
            </button>
            <button
              id="restore-btn"
              class="btn danger"
              :disabled="disabled"
              @click="$emit('restoreChroot')"
            >
              Restore Chroot
            </button>
          </div>
        </div>

        <div class="setting-section danger-zone-section" tabindex="0">
          <h4>Danger Zone</h4>
          <p class="setting-desc">Permanently remove the chroot environment</p>
          <button
            id="uninstall-btn"
            class="btn danger"
            :disabled="disabled"
            @click="$emit('uninstallChroot')"
          >
            Uninstall Chroot
          </button>
        </div>

        <details class="setting-section optional-section" tabindex="0">
          <summary class="optional-toggle">
            <h4>Optional</h4>
          </summary>
          <p class="setting-desc">
            <br />Additional options for advanced users
          </p>

          <div class="setting-subsection">
            <h5>Debug Mode</h5>
            <p class="setting-desc">
              Enable detailed logging for troubleshooting. Logs will be saved to
              /data/logs/ubuntu-chroot/logs
            </p>
            <p class="setting-desc debug-warning-text">
              <Icon name="warning" size="16" class="icon-inline-right" />
              ENABLE THIS ONLY WHEN ABSOLUTE NECESSARY. MAY CAUSE ISSUES IN SOME
              TOOLS LIKE DOCKER
            </p>
            <div class="form-row">
              <label class="row-label row-label-no-margin"
                >Enable debug logging:</label
              >
              <label class="toggle-inline">
                <input
                  id="debug-toggle"
                  type="checkbox"
                  :checked="debugMode"
                  :disabled="disabled"
                  @change="
                    $emit(
                      'update:debugMode',
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                <span>Enable</span>
              </label>
            </div>
          </div>

          <div class="setting-subsection">
            <h5>Optimize Android for Chroot</h5>
            <p class="setting-desc">
              Disable Android Doze and phantom process killing to keep chroot
              processes alive in the background
            </p>
            <div class="form-row">
              <label class="row-label row-label-no-margin"
                >Optimize Android for Chroot by disabling doze and phantom
                process killing:</label
              >
              <label class="toggle-inline">
                <input
                  id="android-optimize-toggle"
                  type="checkbox"
                  :checked="androidOptimize"
                  :disabled="disabled"
                  @change="
                    $emit(
                      'update:androidOptimize',
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                <span>Enable</span>
              </label>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Icon from "@/components/Icon.vue";

interface Props {
  postExecScript: string;
  debugMode: boolean;
  androidOptimize: boolean;
  disabled: boolean;
}

const props = defineProps<Props>();

const popupRef = ref<HTMLElement | null>(null);

defineEmits<{
  close: [];
  "update:postExecScript": [value: string];
  "update:debugMode": [value: boolean];
  "update:androidOptimize": [value: boolean];
  savePostExecScript: [];
  clearPostExecScript: [];
  updateChroot: [];
  backupChroot: [];
  restoreChroot: [];
  uninstallChroot: [];
}>();
</script>

<style scoped></style>

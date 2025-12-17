<template>
  <div id="hotspot-popup" class="popup-overlay" ref="popupRef">
    <div class="popup-content">
      <div class="popup-header">
        <h3>Hotspot Configuration</h3>
        <button
          id="close-hotspot-popup"
          class="close-btn"
          title="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>

      <div class="popup-body">
        <div
          id="hotspot-warning"
          class="warning-banner"
          v-if="hotspotWarningVisible"
        >
          <div class="warning-content">
            <Icon name="warning" size="20" />
            <div class="warning-text">
              <strong>Note:</strong> 5GHz hotspot may not work on all devices -
              try 2.4GHz if needed.
            </div>
          </div>

          <button
            id="dismiss-hotspot-warning"
            class="warning-close"
            title="Dismiss warning"
            @click="$emit('dismissHotspotWarning')"
          >
            ×
          </button>
        </div>

        <div class="setting-section">
          <form id="hotspot-form" @submit.prevent>
            <div class="form-group">
              <label for="hotspot-iface">Upstream Interface:</label>
              <select
                id="hotspot-iface"
                v-model="internalIface"
                :disabled="
                  disabled ||
                  hotspotLoading ||
                  (hotspotIfaces && hotspotIfaces.length === 0) ||
                  !!hotspotIfaceError
                "
                aria-label="Hotspot upstream interface"
              >
                <option value="" disabled v-if="hotspotLoading">
                  Loading interfaces...
                </option>

                <option value="" disabled v-else-if="hotspotIfaceError">
                  {{ hotspotIfaceError }}
                </option>

                <option
                  value=""
                  disabled
                  v-else-if="!hotspotIfaces || hotspotIfaces.length === 0"
                >
                  No interfaces found
                </option>

                <option
                  v-for="iface in hotspotIfaces || []"
                  :key="iface.value"
                  :value="iface.value"
                >
                  {{ iface.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="hotspot-ssid">SSID (Hotspot Name):</label>
              <input
                id="hotspot-ssid"
                type="text"
                :value="hotspotSsid"
                :disabled="disabled"
                @input="$emit('update:hotspotSsid', $event.target.value)"
                placeholder="MyHotspot"
                required
              />
            </div>

            <div class="form-group">
              <label for="hotspot-password">Password:</label>
              <div class="password-input-container">
                <input
                  id="hotspot-password"
                  type="password"
                  :value="hotspotPassword"
                  :disabled="disabled"
                  @input="$emit('update:hotspotPassword', $event.target.value)"
                  placeholder="Min 8 characters"
                  minlength="8"
                  required
                />
                <button
                  type="button"
                  id="toggle-password"
                  class="password-toggle"
                  :disabled="disabled"
                  title="Toggle password visibility"
                  @click="$emit('toggleHotspotPassword')"
                >
                  <Icon name="eye" size="20" />
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="hotspot-band">Band:</label>
              <select
                id="hotspot-band"
                :value="hotspotBand"
                :disabled="disabled"
                @change="$emit('update:hotspotBand', $event.target.value)"
              >
                <option value="2">2.4GHz</option>
                <option value="5">5GHz</option>
              </select>
            </div>

            <div class="form-group">
              <label for="hotspot-channel">Channel:</label>
              <select
                id="hotspot-channel"
                :value="hotspotChannel"
                :disabled="disabled"
                @change="$emit('update:hotspotChannel', $event.target.value)"
                required
              >
                <option
                  v-for="c in hotspotChannels"
                  :key="c"
                  :value="String(c)"
                >
                  {{ c }}
                </option>
              </select>
            </div>
          </form>

          <div class="script-actions">
            <button
              id="refresh-hotspot-ifaces-btn"
              class="btn"
              :disabled="disabled"
              @click="$emit('refreshHotspotIfaces')"
              title="Reload interface list"
            >
              Refresh
            </button>

            <button
              id="start-hotspot-btn"
              class="btn"
              :disabled="disabled"
              @click="$emit('startHotspot')"
            >
              Start Hotspot
            </button>
            <button
              id="stop-hotspot-btn"
              class="btn danger"
              :disabled="disabled"
              @click="$emit('stopHotspot')"
            >
              Stop Hotspot
            </button>
          </div>

          <p class="hotspot-note">
            * If your interface is not listed, press the Refresh button to
            update the interface list.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import Icon from "@/components/Icon.vue";

interface IfaceOption {
  value: string;
  label: string;
}

interface Props {
  hotspotWarningVisible: boolean;
  hotspotIfaces: Array<IfaceOption> | null | undefined;
  hotspotIface: string | null | undefined;
  hotspotSsid: string | null | undefined;
  hotspotPassword: string | null | undefined;
  hotspotBand: string | null | undefined;
  hotspotChannel: string | null | undefined;
  hotspotChannels: number[] | null | undefined;
  hotspotLoading?: boolean;
  hotspotIfaceError?: string | null | undefined;
  disabled: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  dismissHotspotWarning: [];
  "update:hotspotIface": [value: string];
  "update:hotspotSsid": [value: string];
  "update:hotspotPassword": [value: string];
  "update:hotspotBand": [value: string];
  "update:hotspotChannel": [value: string];
  toggleHotspotPassword: [];
  startHotspot: [];
  stopHotspot: [];
  refreshHotspotIfaces: [];
}>();

const popupRef = ref<HTMLElement | null>(null);
const internalIface = ref<string>(props.hotspotIface ?? "");

// Keep internal selected iface in sync with parent prop
watch(
  () => props.hotspotIface,
  (v) => {
    if (v !== internalIface.value) internalIface.value = v ?? "";
  },
);

// Emit updates from internal to parent (v-model like)
watch(internalIface, (v) => {
  if (v !== (props.hotspotIface ?? "")) {
    emit("update:hotspotIface", v ?? "");
  }
});

onMounted(() => {
  internalIface.value = props.hotspotIface ?? "";
});
</script>

<style scoped></style>

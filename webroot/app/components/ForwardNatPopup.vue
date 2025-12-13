<template>
  <div id="forward-nat-popup" class="popup-overlay" ref="popupRef">
    <div class="popup-content">
      <div class="popup-header">
        <h3>Forward Chroot Traffic</h3>
        <button
          id="close-forward-nat-popup"
          class="close-btn"
          title="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
      <div class="popup-body">
        <div class="setting-section">
          <p class="setting-desc">
            Forward localhost services (VNC, XRDP, SSH) from the chroot to a
            network interface.<br /><br />This allows you to access chroot
            services from other devices on your network.
          </p>
          <div class="form-group">
            <label for="forward-nat-iface">Network Interface:</label>
            <select
              id="forward-nat-iface"
              v-model="internalIface"
              :disabled="
                forwardNatLoading ||
                (forwardNatIfaces && forwardNatIfaces.length === 0)
              "
            >
              <option value="" disabled v-if="forwardNatLoading">
                Loading interfaces...
              </option>
              <option
                value=""
                disabled
                v-else-if="!forwardNatIfaces || forwardNatIfaces.length === 0"
              >
                No interfaces found
              </option>
              <option
                v-for="iface in forwardNatIfaces || []"
                :key="iface.value"
                :value="iface.value"
              >
                {{ iface.label }}
              </option>
            </select>
          </div>
          <div class="script-actions">
            <button
              id="start-forwarding-btn"
              class="btn"
              @click="$emit('startForwarding')"
            >
              Start Forwarding
            </button>
            <button
              id="stop-forwarding-btn"
              class="btn danger"
              @click="$emit('stopForwarding')"
            >
              Stop Forwarding
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";

interface Props {
  forwardNatIfaces?: Array<{ value: string; label: string }>;
  forwardNatIface?: string;
  forwardNatLoading?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  "update:forwardNatIface": [value: string];
  startForwarding: [];
  stopForwarding: [];
}>();

const popupRef = ref<HTMLElement | null>(null);
const internalIface = ref<string>(props.forwardNatIface ?? "");

watch(
  () => props.forwardNatIface,
  (v) => {
    if (v !== internalIface.value) internalIface.value = v ?? "";
  },
);

watch(internalIface, (v) => {
  if (v !== props.forwardNatIface) emit("update:forwardNatIface", v ?? "");
});

onMounted(() => {
  internalIface.value = props.forwardNatIface ?? "";
});
</script>

<style scoped></style>

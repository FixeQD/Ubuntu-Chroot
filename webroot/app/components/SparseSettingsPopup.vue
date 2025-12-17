<template>
  <div id="sparse-settings-popup" class="popup-overlay" ref="popupRef">
    <div class="popup-content">
      <div class="popup-header">
        <h3>Sparse Image Settings</h3>
        <button
          id="close-sparse-popup"
          class="close-btn"
          title="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
      <div class="popup-body">
        <div class="setting-section">
          <h4>Storage Optimization</h4>
          <p class="setting-desc">Optimize your sparse image storage usage</p>

          <div class="setting-subsection">
            <h5>Trim Sparse Image</h5>
            <p class="setting-desc">
              Reclaim unused space in the sparse image by running fstrim. This
              will shrink the image file by removing unused blocks.
            </p>
            <button
              id="trim-sparse-btn"
              class="btn"
              :disabled="disabled"
              @click="$emit('trimSparseImage')"
            >
              Trim Sparse Image
            </button>
          </div>

          <div class="setting-subsection">
            <h5>Resize Sparse Image</h5>
            <p class="setting-desc">
              Change the maximum size of your sparse image (4-512GB). Make a
              backup first - this operation can corrupt your filesystem if
              interrupted.
            </p>
            <button
              id="resize-sparse-btn"
              class="btn outline"
              :disabled="disabled"
              @click="$emit('resizeSparseImage')"
            >
              Resize Sparse Image
            </button>
          </div>
        </div>

        <div class="setting-section danger-zone-section" tabindex="0">
          <h4>Storage Information</h4>
          <div id="sparse-info" class="setting-desc">
            Loading storage information...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface Props {
  disabled: boolean;
}

const props = defineProps<Props>();

const popupRef = ref<HTMLElement | null>(null);

defineEmits<{
  close: [];
  trimSparseImage: [];
  resizeSparseImage: [];
}>();
</script>

<style scoped>
/* Styles are global */
</style>

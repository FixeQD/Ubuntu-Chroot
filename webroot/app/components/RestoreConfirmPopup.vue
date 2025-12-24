<template>
  <div v-if="visible" class="popup-overlay active" @click="closeOnOverlay">
    <div class="popup-content">
      <div class="popup-header">
        <h3>Confirm Restore</h3>
        <button class="close-btn" @click="$emit('cancel')" title="Close">
          ×
        </button>
      </div>
      <div class="popup-body">
        <div class="warning-banner">
          <div class="warning-content">
            <Icon name="warning" size="20" fill="currentColor" />
            <div class="warning-text">
              <strong>Warning:</strong> This action will destroy the current
              chroot installation and replace it with the backup.
            </div>
          </div>
        </div>
        <p>
          Are you sure you want to restore the Ubuntu chroot environment from a
          backup?
        </p>
        <div class="script-actions">
          <button class="btn outline" @click="$emit('cancel')">Cancel</button>
          <button class="btn danger" @click="$emit('confirm')">Restore</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon.vue";

interface Props {
  visible: boolean;
}

defineProps<Props>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();

const closeOnOverlay = (event: Event) => {
  if ((event.target as HTMLElement).classList.contains("popup-overlay")) {
    emit("cancel");
  }
};
</script>

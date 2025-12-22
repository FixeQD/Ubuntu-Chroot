<template>
  <div v-if="visible" class="popup-overlay active" @click="closeOnOverlay">
    <div class="popup-content">
      <div class="popup-header">
        <h3>Confirm Uninstall</h3>
        <button class="close-btn" @click="$emit('cancel')" title="Close">
          ×
        </button>
      </div>
      <div class="popup-body">
        <div class="warning-banner">
          <div class="warning-content">
            <Icon name="warning" size="20" fill="currentColor" />
            <div class="warning-text">
              <strong>Warning:</strong> This action cannot be undone. All data
              in the chroot environment will be permanently deleted.
            </div>
          </div>
        </div>
        <p>Are you sure you want to uninstall the Ubuntu chroot environment?</p>
        <div class="script-actions">
          <button class="btn outline" @click="$emit('cancel')">Cancel</button>
          <button class="btn danger" @click="$emit('confirm')">
            Uninstall
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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

<style scoped>
.popup-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  height: 100%;
  justify-content: center;
  left: 0;
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
}

[data-theme="dark"] .popup-overlay {
  background: rgba(0, 0, 0, 0.6);
}

.popup-content {
  background: var(--card);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--surface-radius);
  box-shadow: 0 6px 20px #06080e0f;
  max-height: 85vh;
  max-width: 500px;
  overflow-y: auto;
  transform: scale(1);
  transition: transform 0.3s ease;
  width: 95%;
}

.popup-header {
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  padding: 20px 24px 16px;
}

[data-theme="dark"] .popup-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.popup-header h3 {
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  align-items: center;
  background: transparent;
  border: 1px solid rgba(15, 23, 32, 0.08);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  display: flex;
  height: 36px;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
  width: 36px;
}

[data-theme="dark"] .close-btn {
  border-color: rgba(255, 255, 255, 0.08);
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  transform: rotate(90deg);
}

[data-theme="dark"] .close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.popup-body {
  padding: 24px;
}

.warning-banner {
  align-items: flex-start;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: var(--surface-radius);
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  position: relative;
}

[data-theme="dark"] .warning-banner {
  background: #451a03;
  border-color: #ea580c;
}

.warning-content {
  align-items: flex-start;
  display: flex;
  flex: 1;
  gap: 10px;
}

.warning-content svg {
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 1px;
}

[data-theme="dark"] .warning-content svg {
  color: #ea580c;
}

.warning-text {
  color: #92400e;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

[data-theme="dark"] .warning-text {
  color: #fed7aa;
}

.script-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn {
  background: var(--accent);
  border: 0;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  padding: 8px 12px;
  transition:
    transform 0.12s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.12s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s ease,
    border-color 0.15s ease;
}

.btn.outline {
  background: transparent;
  border: 1px solid rgba(15, 23, 32, 0.08);
  color: var(--text);
}

[data-theme="dark"] .btn.outline {
  border-color: rgba(255, 255, 255, 0.08);
}

.btn.danger {
  background: var(--danger);
  border: 1px solid var(--danger);
}

.btn:hover:not([disabled]) {
  box-shadow: 0 4px 12px #00000026;
  transform: translateY(-1px);
}

.btn.danger:hover:not([disabled]) {
  background: #b91c1c;
  border-color: #b91c1c;
  box-shadow: 0 4px 12px #dc26264d;
}
</style>

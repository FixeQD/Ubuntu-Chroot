<template>
  <Teleport to="body">
    <transition name="fade" appear>
      <div v-if="visible" class="backup-progress-overlay">
        <transition name="scale" appear>
          <div class="backup-progress-dialog">
            <h3>{{ title }}</h3>
            <p>{{ message }}</p>
            <div class="spinner"></div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
  title: string;
  message: string;
}

const props = defineProps<Props>();
</script>

<style scoped>
.backup-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.backup-progress-dialog {
  background: var(--card);
  border-radius: var(--surface-radius);
  box-shadow: 0 6px 20px rgba(6, 8, 14, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.08);
  max-width: 400px;
  width: 90%;
  padding: 24px;
  text-align: center;
}

.backup-progress-dialog h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.backup-progress-dialog p {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: transform 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0.9);
}
</style>

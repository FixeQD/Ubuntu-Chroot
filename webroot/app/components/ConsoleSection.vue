<template>
  <section class="card console-card">
    <div class="console-header">
      <span class="console-title">Console</span>
      <button
        id="copy-console"
        class="btn outline small console-copy-btn"
        title="Copy console logs"
        @click="logBuffer.copyLogs()"
      >
        <Icon name="copy" size="16" />
      </button>
    </div>
    <pre id="console" class="console" ref="consoleEl"></pre>
    <div class="console-actions">
      <button
        id="clear-console"
        class="btn outline small"
        @click="logBuffer.clearConsole()"
      >
        Clear
      </button>
      <button
        id="refresh-status"
        class="btn small"
        @click="$emit('refreshStatusManual')"
      >
        Refresh
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import Icon from "@/components/Icon.vue";
import useConsole from "@/composables/useConsole";

interface Props {
  logBuffer: ReturnType<typeof useConsole>;
}

const props = defineProps<Props>();

const { logBuffer } = props;

const consoleEl = ref<HTMLElement | null>(null);

onMounted(() => {
  if (logBuffer && logBuffer.consoleRef) {
    logBuffer.consoleRef.value = consoleEl.value;
  } else {
    (logBuffer as any).consoleRef = consoleEl;
  }
});

onUnmounted(() => {
  // Clear the ref value so the composable can detach listeners/cleanup.
  if (logBuffer && logBuffer.consoleRef) {
    logBuffer.consoleRef.value = null;
  }
});

defineEmits<{
  refreshStatusManual: [];
}>();
</script>

<style scoped></style>

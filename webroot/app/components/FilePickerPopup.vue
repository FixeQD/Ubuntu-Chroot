<template>
  <Teleport to="body">
    <transition name="fade" appear>
      <div v-if="visible" class="overlay" @click.self="cancel">
        <transition name="scale" appear>
          <div class="dialog">
            <h3>{{ title }}</h3>
            <p>{{ message }}</p>
            <div class="form">
              <template v-if="!forRestore">
                <label>Directory:</label>
                <input
                  v-model="path"
                  type="text"
                  placeholder="/sdcard/backup"
                  ref="pathInput"
                />
                <label>Filename:</label>
                <input
                  v-model="filename"
                  type="text"
                  placeholder="chroot-backup.tar.gz"
                  @input="autoAppend"
                  ref="filenameInput"
                />
              </template>
              <template v-else>
                <label>Backup File Path:</label>
                <input
                  v-model="path"
                  type="text"
                  placeholder="/sdcard/chroot-backup.tar.gz"
                  ref="pathInput"
                />
              </template>
            </div>
            <div class="buttons">
              <button @click="cancel">Cancel</button>
              <button @click="select">
                {{ forRestore ? "Select File" : "Select Location" }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from "vue";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  defaultPath?: string;
  defaultFilename?: string;
  forRestore?: boolean;
  onResolve: (path: string | null) => void;
}

const props = withDefaults(defineProps<Props>(), {
  forRestore: false,
});

const path = ref(props.defaultPath || "");
const filename = ref(props.defaultFilename || "");

const pathInput = ref<HTMLInputElement>();
const filenameInput = ref<HTMLInputElement>();

const autoAppend = () => {
  if (!filename.value.includes(".tar.gz") && filename.value.length > 0) {
    filename.value = filename.value.replace(/\.tar\.gz$/, "") + ".tar.gz";
  }
};

const cancel = () => {
  props.onResolve(null);
};

const select = () => {
  let selectedPath = "";
  if (!props.forRestore) {
    if (path.value && filename.value) {
      selectedPath =
        path.value + (path.value.endsWith("/") ? "" : "/") + filename.value;
    }
  } else {
    selectedPath = path.value.trim();
  }

  if (selectedPath) {
    if (props.forRestore && !selectedPath.endsWith(".tar.gz")) {
      alert("Please select a valid .tar.gz backup file");
      return;
    }
    props.onResolve(selectedPath);
  } else {
    alert("Please enter a valid path");
  }
};

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick();
      if (props.forRestore) {
        pathInput.value?.focus();
      } else {
        filenameInput.value?.focus();
      }
    }
  },
);

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.visible) return;
  if (e.key === "Escape") {
    cancel();
  } else if (e.key === "Enter") {
    select();
  }
};

document.addEventListener("keydown", handleKeyDown);

// Cleanup on unmount
import { onUnmounted } from "vue";
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background: var(--card);
  border-radius: var(--surface-radius);
  box-shadow: 0 6px 20px rgba(6, 8, 14, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.08);
  max-width: 450px;
  width: 90%;
  padding: 24px;
}

h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

p {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}

.form {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text);
  font-size: 14px;
}

input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  font-size: 14px;
  box-sizing: border-box;
  margin-bottom: 12px;
}

input:last-child {
  margin-bottom: 0;
}

.buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

button {
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

button:first-child {
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: transparent;
  color: var(--text);
}

button:first-child:hover {
  background: rgba(255, 255, 255, 0.05);
}

button:last-child {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
}

button:last-child:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* Dark mode */
[data-theme="dark"] .dialog {
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] button:first-child {
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] input {
  border-color: rgba(255, 255, 255, 0.08);
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

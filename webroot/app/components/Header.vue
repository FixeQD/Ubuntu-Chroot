<template>
  <header class="top">
    <div class="brand">
      <img
        src="/assets/logo.png"
        alt="Ubuntu Chroot Manager"
        class="header-logo"
      />
    </div>
    <div class="controls">
      <button
        id="forward-nat-btn"
        class="theme-btn"
        title="Forward the Chroot Traffic to any interface"
        @click="$emit('openForwardNatPopup')"
      >
        <Icon name="forward-nat" />
      </button>
      <button
        id="hotspot-btn"
        class="theme-btn"
        title="Hotspot"
        @click="$emit('openHotspotPopup')"
      >
        <Icon name="hotspot" />
      </button>
      <button
        id="settings-btn"
        class="theme-btn"
        title="Options"
        @click="
          onBeforeOpenSettings?.();
          $emit('openSettingsPopup');
        "
      >
        <Icon name="settings" />
      </button>
      <button
        id="theme-toggle"
        class="theme-btn"
        :aria-pressed="isDark"
        title="Toggle theme"
        @click="toggleTheme"
      >
        <Icon name="sun" class="icon icon-sun" />
        <Icon name="moon" class="icon icon-moon" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import Icon from "@/components/Icon.vue";

interface Props {
  onBeforeOpenSettings?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  onBeforeOpenSettings: undefined,
});

/**
 * Theme handling:
 * - Detects system preference and localStorage value on mount
 * - Uses data-theme attribute on <html> to switch
 * - Persists choice in localStorage under 'chroot_theme'
 */
const isDark = ref(false);

onMounted(() => {
  try {
    // Check localStorage first, fallback to system preference
    const stored = localStorage.getItem("chroot_theme");
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;

    isDark.value = stored === "dark" ? true : !stored && prefersDark;
    document.documentElement.setAttribute(
      "data-theme",
      isDark.value ? "dark" : "",
    );
  } catch (e) {
    // Keep default (light) on error
  }
});

watch(isDark, (val) => {
  try {
    localStorage.setItem("chroot_theme", val ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", val ? "dark" : "");
  } catch (e) {
    // ignore storage failures
  }
});

function toggleTheme() {
  isDark.value = !isDark.value;
}
</script>

<style scoped>
/* Styles are global */
</style>

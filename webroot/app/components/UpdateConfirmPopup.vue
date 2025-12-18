<template>
  <div
    v-if="visible"
    class="popup-overlay active"
    @click="$emit('cancel')"
  >
    <div class="popup" @click.stop>
      <h3>Update Chroot Environment</h3>
      <p>This will apply any available updates to the chroot environment.</p>
      <p>The chroot will be started if it's not running. Continue?</p>
      <div class="buttons">
        <button class="btn" @click="$emit('confirm')">
          Yes
        </button>
        <button class="btn" @click="$emit('cancel')">No</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<style scoped>
/* Styles are global for popups */
</style>

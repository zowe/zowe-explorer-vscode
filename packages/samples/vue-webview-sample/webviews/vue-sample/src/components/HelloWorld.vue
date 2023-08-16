<script setup lang="ts">
declare var acquireVsCodeApi: Function;

defineProps<{ msg: string }>();

const vscodeApi = acquireVsCodeApi();

function sendMsg() {
  // .value is needed in JavaScript
  vscodeApi.postMessage({
    text: "Hello from Vue!",
  });
}
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <button type="button" @click="sendMsg">Send message to ZE</button>
  </div>
</template>

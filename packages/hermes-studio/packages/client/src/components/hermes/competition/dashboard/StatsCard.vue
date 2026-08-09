<script setup lang="ts">import { NCard, NStatistic } from 'naive-ui'; defineProps<{ label: string; value: string | number; suffix?: string }>()</script>
<template><NCard size="small" class="stats-card"><NStatistic :label="label" :value="value" :suffix="suffix" /></NCard></template>

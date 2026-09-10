<template>
	<div ref="containerRef" />
</template>

<script setup lang="ts">
import {ref, watch, onBeforeUnmount} from 'vue'
import {Region} from 'marionette'
import type {RegionInstance} from 'marionette'
import type {ViewInstance} from 'marionette'

export type ViewFactory = () => ViewInstance

const props = defineProps<{
	viewFactory: ViewFactory
}>()

const containerRef = ref<HTMLElement | null>(null)
let region: RegionInstance | null = null

watch(
	[containerRef, () => props.viewFactory],
	([el, factory]) => {
		if (!el) return

		if (!region) {
			region = new Region({el})
		}

		const view = factory()
		region.show(view)
	},
	{flush: 'post'},
)

onBeforeUnmount(() => {
	region?.destroy()
	region = null
})
</script>

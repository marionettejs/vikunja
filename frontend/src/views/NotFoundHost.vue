<script setup lang="ts">
import {ref, onMounted, onBeforeUnmount, watch} from 'vue'
import {i18n} from '@/i18n'
import NotFoundView from '@/marionette/views/NotFoundView'

const container = ref<HTMLElement | null>(null)
let view: InstanceType<typeof NotFoundView> | null = null
let isUnmounted = false

function updateDocumentTitle(): void {
	document.title = `${i18n.global.t('404.title')} | Vikunja`
}

function renderView(): void {
	if (!container.value) {
		return
	}
	updateDocumentTitle()
	if (view) {
		view.destroy()
		view = null
	}
	view = new NotFoundView({
		title: i18n.global.t('404.title'),
		text: i18n.global.t('404.text'),
	})
	view.render()
	container.value.replaceChildren(view.el)
}

watch(
	() => i18n.global.locale.value,
	() => {
		if (view) {
			renderView()
		}
	},
)

onMounted(() => {
	renderView()
})

onBeforeUnmount(() => {
	isUnmounted = true
	if (view) {
		view.destroy()
		view = null
	}
})
</script>

<template>
	<div ref="container" />
</template>
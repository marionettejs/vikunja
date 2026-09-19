<script setup lang="ts">
import {onMounted, onUnmounted, watch} from 'vue'
import {useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import {useConfigStore} from '@/stores/config'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import AboutVersionView from '@/marionette/views/AboutVersionView'

const router = useRouter()
const configStore = useConfigStore()
const {t, locale} = useI18n()

import {VERSION as frontendVersion} from '@/version.json'

let activeModal: InstanceType<typeof ModalCardView> | null = null
let isMounted = true

function destroyModal(): void {
	if (activeModal) {
		activeModal.destroy()
		activeModal = null
	}
}

function buildLines(configVersion: string): string[] {
	const versionsEqual = configVersion === frontendVersion
	if (versionsEqual) {
		return [t('about.version', {version: configVersion})]
	}
	return [
		t('about.frontendVersion', {version: frontendVersion}),
		t('about.apiVersion', {version: configVersion}),
	]
}

function renderModal(configVersion: string): void {
	destroyModal()

	const lines = buildLines(configVersion)

	const modal = new ModalCardView({
		title: t('about.title'),
		primaryLabel: t('misc.close'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		hideCancel: true,
		primaryButtonClass: 'is-outlined',
		onPrimary: () => {
			destroyModal()
			router.back()
		},
		onClose: () => {
			destroyModal()
			router.back()
		},
	})
	activeModal = modal
	modal.render()
	modal.showChildView('body', new AboutVersionView({lines}))
}

onMounted(() => {
	renderModal(configStore.version)
})

watch(
	() => configStore.version,
	(newVersion) => {
		if (isMounted) {
			renderModal(newVersion)
		}
	},
)

watch(locale, () => {
	if (isMounted) {
		renderModal(configStore.version)
	}
})

onUnmounted(() => {
	isMounted = false
	destroyModal()
})
</script>

<template>
	<div />
</template>
<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {ConfirmTextView} from '@/marionette/views/ConfirmTextView'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import type {IProject} from '@/modelTypes/IProject'
import {useSavedFilter} from '@/services/savedFilter'

const props = defineProps<{
	projectId: IProject['id']
}>()

const router = useRouter()
const {deleteFilter} = useSavedFilter(() => props.projectId)

const modalRegion = ref<HTMLElement | null>(null)
let activeModal: InstanceType<typeof ModalCardView> | null = null

function t(key: string): string {
	return i18n.global.t(key)
}

function destroyModal(): void {
	if (activeModal) {
		activeModal.destroy()
		activeModal = null
	}
	if (modalRegion.value) {
		modalRegion.value.innerHTML = ''
	}
}

function renderModal(modal: InstanceType<typeof ModalCardView>): void {
	modal.render()
	modalRegion.value?.appendChild(modal.el)
}

onMounted(() => {
	destroyModal()
	if (!modalRegion.value) {
		return
	}

	const modal = new ModalCardView({
		title: t('filters.delete.header'),
		primaryLabel: t('misc.doit'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		onPrimary: () => {
			destroyModal()
			deleteFilter()
		},
		onClose: () => {
			destroyModal()
			router.back()
		},
	})
	activeModal = modal
	renderModal(modal)
	// showChildView after rendering: a second render clears the regions and
	// destroys the body view with it.
	modal.showChildView('body', new ConfirmTextView({
		lines: [t('filters.delete.text')],
	}))
})

onUnmounted(() => {
	destroyModal()
})
</script>

<template>
	<div ref="modalRegion" />
</template>

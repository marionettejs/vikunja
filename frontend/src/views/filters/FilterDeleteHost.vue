<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {error} from '@/message'
import {ConfirmTextView} from '@/marionette/views/ConfirmTextView'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import type {IProject} from '@/modelTypes/IProject'
import {useSavedFilter} from '@/services/savedFilter'

const props = defineProps<{
	projectId: IProject['id']
}>()

const router = useRouter()
const {deleteFilter, filter, filterService} = useSavedFilter(() => props.projectId)

let activeModal: InstanceType<typeof ModalCardView> | null = null
const isSubmitting = ref(false)
let isMounted = true

function t(key: string): string {
	return i18n.global.t(key)
}

function destroyModal(): void {
	if (activeModal) {
		activeModal.destroy()
		activeModal = null
	}
}

function updatePrimaryDisabled(): void {
	activeModal?.setPrimaryDisabled(
		isSubmitting.value || filterService.loading || filter.value.id <= 0,
	)
}

function renderModal(): void {
	destroyModal()

	const modal = new ModalCardView({
		title: t('filters.delete.header'),
		primaryLabel: t('misc.doit'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		primaryDisabled: isSubmitting.value || filterService.loading || filter.value.id <= 0,
		onPrimary: async () => {
			if (isSubmitting.value || filterService.loading || filter.value.id <= 0) {
				return
			}

			isSubmitting.value = true
			activeModal?.setPrimaryDisabled(true)
			activeModal?.setDismissible(false)

			try {
				await deleteFilter()
			} catch (e) {
				isSubmitting.value = false
				if (!isMounted) {
					return
				}
				error(e)
				activeModal?.setDismissible(true)
				updatePrimaryDisabled()
			}
		},
		onClose: () => {
			destroyModal()
			router.back()
		},
	})
	activeModal = modal
	if (isSubmitting.value) {
		modal.setDismissible(false)
	}
	modal.render()
	modal.showChildView('body', new ConfirmTextView({
		lines: [t('filters.delete.text')],
	}))
}

onMounted(() => {
	renderModal()
})

watch(
	() => [filterService.loading, filter.value.id] as const,
	updatePrimaryDisabled,
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderModal()
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

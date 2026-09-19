<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {useSavedFilter} from '@/services/savedFilter'
import {useLabels} from '@/composables/useLabels'
import {useProjectStore} from '@/stores/projects'
import {useAuthStore} from '@/stores/auth'
import {useFlatpickrLanguage} from '@/helpers/useFlatpickrLanguage'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import {FilterEditFormView} from '@/marionette/views/FilterEditFormView'
import {hasFilterQuery} from '@/helpers/filters'
import type {IProject} from '@/modelTypes/IProject'

const props = defineProps<{
	projectId: IProject['id'],
}>()

const router = useRouter()
const {saveFilterWithValidation, filter, filters, filterService, titleValid, validateTitleField} = useSavedFilter(() => props.projectId)
const {labels, isPending: labelsPending, getLabelByExactTitle, getLabelById} = useLabels()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const flatpickrLanguage = useFlatpickrLanguage()

let activeModal: InstanceType<typeof ModalCardView> | null = null
let activeFormView: InstanceType<typeof FilterEditFormView> | null = null
let isMounted = true
const isSubmitting = ref(false)

function t(key: string): string {
	return i18n.global.t(key)
}

function destroyModal(): void {
	if (activeModal) {
		activeModal.destroy()
		activeModal = null
	}
	activeFormView = null
}

function isLoading(): boolean {
	return isSubmitting.value || filterService.loading
}

function updatePrimaryDisabled(): void {
	activeModal?.setPrimaryDisabled(isLoading() || !titleValid.value)
}

function findProjectByExactname(title: string): {id: number; title: string} | undefined {
	const found = projectStore.findProjectByExactname(title)
	return found ? {id: found.id, title: found.title} : undefined
}

function getProjectTitle(id: number): string | undefined {
	return projectStore.projects[id]?.title
}

function populateForm(): void {
	if (!activeFormView || !isMounted) {
		return
	}
	activeFormView.setTitle(filter.value.title)
	activeFormView.setDescription(filter.value.description)
	activeFormView.setQuery(filter.value.filters?.filter || filter.value.filters?.s || '')
	activeFormView.setLoading(isLoading())
	activeFormView.setTitleValid(titleValid.value)
}

async function handleSave(): Promise<void> {
	if (isSubmitting.value) {
		return
	}

	isSubmitting.value = true
	updatePrimaryDisabled()
	activeFormView?.setLoading(true)

	try {
		await saveFilterWithValidation()
	} finally {
		isSubmitting.value = false
		if (isMounted) {
			updatePrimaryDisabled()
			activeFormView?.setLoading(isLoading())
		}
	}
}

function renderModal(): void {
	destroyModal()

	const modal = new ModalCardView({
		title: t('filters.edit.title'),
		primaryLabel: t('misc.save'),
		primaryButtonClass: 'is-primary',
		cancelLabel: t('misc.cancel'),
		cancelButtonClass: 'is-outlined',
		closeLabel: t('misc.closeDialog'),
		tertiaryLabel: t('misc.delete'),
		onTertiary: () => {
			router.push({name: 'filter.settings.delete', params: {id: props.projectId}})
		},
		primaryDisabled: isLoading() || !titleValid.value,
		onPrimary: () => {
			void handleSave()
		},
		onClose: () => {
			destroyModal()
			router.back()
		},
	})

	activeModal = modal

	const formView = new FilterEditFormView({
		t,
		labels: labels.value,
		labelsPending: labelsPending.value,
		getLabelByExactTitle,
		getLabelById,
		findProjectByExactname,
		getProjectTitle,
		flatpickrLocale: flatpickrLanguage.value,
		weekStart: authStore.settings.weekStart,
		onTitleChange: (title: string) => {
			filter.value.title = title
		},
		onTitleValidate: () => {
			validateTitleField()
		},
		onDescriptionChange: (description: string) => {
			filter.value.description = description
		},
		onQueryChange: (query: string) => {
			const s = hasFilterQuery(query) ? '' : query
			filters.value = {...filters.value, filter: s === '' ? query : '', s}
		},
		onSave: () => {
			void handleSave()
		},
		loading: isLoading(),
		titleValid: titleValid.value,
		initialTitle: filter.value.title,
		initialDescription: filter.value.description,
		initialQuery: filter.value.filters?.filter || filter.value.filters?.s || '',
	}) as InstanceType<typeof FilterEditFormView>

	activeFormView = formView

	modal.render()
	modal.showChildView('body', formView)
}

onMounted(() => {
	renderModal()
})

watch(
	() => [isSubmitting.value, filterService.loading, titleValid.value] as const,
	() => {
		updatePrimaryDisabled()
		activeFormView?.setLoading(isLoading())
	},
)

watch(
	() => titleValid.value,
	(valid) => {
		activeFormView?.setTitleValid(valid)
	},
)

watch(
	() => [filter.value.id, filter.value.title, filter.value.description] as const,
	() => {
		populateForm()
	},
)

watch(
	() => labelsPending.value,
	(pending) => {
		if (activeFormView) {
			activeFormView.updateLabels(labels.value, pending)
		}
	},
)

watch(
	() => labels.value,
	(newLabels) => {
		activeFormView?.updateLabels(newLabels, labelsPending.value)
	},
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderModal()
		populateForm()
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

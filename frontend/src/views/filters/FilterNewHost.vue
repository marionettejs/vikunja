<script setup lang="ts">
import {onMounted, onUnmounted, watch} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {useSavedFilter} from '@/services/savedFilter'
import {useLabels} from '@/composables/useLabels'
import {useProjectStore} from '@/stores/projects'
import {useAuthStore} from '@/stores/auth'
import {useFlatpickrLanguage} from '@/helpers/useFlatpickrLanguage'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import {FilterNewFormView} from '@/marionette/views/FilterNewFormView'
import {hasFilterQuery} from '@/helpers/filters'

const router = useRouter()
const {createFilterWithValidation, filter, filters, filterService, titleValid, validateTitleField} = useSavedFilter()
const {labels, isPending: labelsPending, getLabelByExactTitle, getLabelById} = useLabels()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const flatpickrLanguage = useFlatpickrLanguage()

let activeModal: InstanceType<typeof ModalCardView> | null = null
let activeFormView: InstanceType<typeof FilterNewFormView> | null = null
let isMounted = true

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

function updatePrimaryDisabled(): void {
	activeModal?.setPrimaryDisabled(
		filterService.loading || !titleValid.value,
	)
}

function findProjectByExactname(title: string): {id: number; title: string} | undefined {
	const found = projectStore.findProjectByExactname(title)
	return found ? {id: found.id, title: found.title} : undefined
}

function getProjectTitle(id: number): string | undefined {
	return projectStore.projects[id]?.title
}

function renderModal(): void {
	destroyModal()

	const initialTitle = filter.value.title
	const initialDescription = filter.value.description
	const initialQuery = filter.value.filters?.filter || filter.value.filters?.s || ''

	const modal = new ModalCardView({
		title: t('filters.create.title'),
		primaryLabel: t('filters.create.action'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		primaryDisabled: filterService.loading || !titleValid.value,
		hideCancel: true,
		primaryButtonClass: 'is-primary is-fullwidth',
		onPrimary: () => {
			if (filterService.loading || !titleValid.value) {
				return
			}
			void createFilterWithValidation()
		},
		onClose: () => {
			destroyModal()
			router.back()
		},
	})

	activeModal = modal

	const formView = new FilterNewFormView({
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
			// Mirrors Filters.vue change(): split the API query into a
			// structured filter vs a plain search string.
			const s = hasFilterQuery(query) ? '' : query
			filters.value = {...filters.value, filter: s === '' ? query : '', s}
		},
		loading: filterService.loading,
		titleValid: titleValid.value,
		initialTitle,
		initialDescription,
		initialQuery,
	}) as InstanceType<typeof FilterNewFormView>

	activeFormView = formView

	modal.render()
	modal.showChildView('body', formView)
}

onMounted(() => {
	renderModal()
})

watch(
	() => [filterService.loading, titleValid.value] as const,
	updatePrimaryDisabled,
)

watch(
	() => filterService.loading,
	(loading) => {
		if (activeFormView) {
			activeFormView.setLoading(loading)
		}
	},
)

watch(
	() => titleValid.value,
	(valid) => {
		if (activeFormView) {
			activeFormView.setTitleValid(valid)
		}
	},
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderModal()
	}
})

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
		if (activeFormView) {
			activeFormView.updateLabels(newLabels, labelsPending.value)
		}
	},
)

onUnmounted(() => {
	isMounted = false
	destroyModal()
})
</script>

<template>
	<div />
</template>
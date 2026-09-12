<template>
	<div />
</template>

<script setup lang="ts">
import {onMounted, onUnmounted, reactive, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {error, success} from '@/message'
import TeamModel from '@/models/team'
import TeamService from '@/services/team'
import {useConfigStore} from '@/stores/config'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import {NewTeamFormView} from '@/marionette/views/NewTeamFormView'

const router = useRouter()
const configStore = useConfigStore()
const teamService = new TeamService()

let modalView: InstanceType<typeof ModalCardView> | null = null
let formView: InstanceType<typeof NewTeamFormView> | null = null
let isMounted = true
const isSubmitting = ref(false)

function updateDocumentTitle() {
	document.title = `${i18n.global.t('team.create.title')} | Vikunja`
}

function renderViews() {
	const initialValues = formView?.getValues()

	if (modalView) {
		modalView.destroy()
		modalView = null
		formView = null
	}

	updateDocumentTitle()

	formView = new NewTeamFormView({
		labels: {
			name: i18n.global.t('team.attributes.name'),
			namePlaceholder: i18n.global.t('team.attributes.namePlaceholder'),
			nameRequired: i18n.global.t('team.attributes.nameRequired'),
			isPublic: i18n.global.t('team.attributes.isPublic'),
			isPublicDescription: i18n.global.t('team.attributes.isPublicDescription'),
		},
		showPublicOption: configStore.publicTeamsEnabled,
		initialName: initialValues?.name,
		initialIsPublic: initialValues?.isPublic,
		onValidityChange: (isValid: boolean) => {
			modalView?.setPrimaryDisabled(!isValid || isSubmitting.value)
		},
		onSubmit: async (values: {name: string, isPublic: boolean}) => {
			if (isSubmitting.value) {
				return
			}
			isSubmitting.value = true
			modalView?.setPrimaryDisabled(true)
			modalView?.setDismissible(false)
			formView?.setDisabled(true)

			let createdId: number | undefined
			try {
				const model = reactive(new TeamModel({
					name: values.name,
					isPublic: values.isPublic,
				}))
				const created = await teamService.create(model)
				createdId = created.id
			} catch (e) {
				if (!isMounted) {
					return
				}
				error(e)
				modalView?.setDismissible(true)
				formView?.setDisabled(false)
				modalView?.setPrimaryDisabled(!formView?.isValid())
				isSubmitting.value = false
				return
			}

			if (!isMounted || createdId === undefined) {
				return
			}
			try {
				await router.push({name: 'teams.edit', params: {id: createdId}})
				success({message: i18n.global.t('team.create.success')})
			} catch (e) {
				if (!isMounted) {
					return
				}
				success({message: i18n.global.t('team.create.success')})
				error(e)
				modalView?.setDismissible(true)
			}
		},
	})

	if (isSubmitting.value) {
		formView.setDisabled(true)
	}

	modalView = new ModalCardView({
		title: i18n.global.t('team.create.title'),
		primaryLabel: i18n.global.t('misc.create'),
		cancelLabel: i18n.global.t('misc.cancel'),
		closeLabel: i18n.global.t('misc.closeDialog'),
		primaryDisabled: !formView.isValid() || isSubmitting.value,
		onPrimary: () => {
			formView?.submit()
		},
		onClose: () => {
			router.back()
		},
	})

	if (isSubmitting.value) {
		modalView.setDismissible(false)
	}

	modalView.showChildView('body', formView)
}

onMounted(() => {
	renderViews()
})

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderViews()
	}
})

onUnmounted(() => {
	isMounted = false
	if (modalView) {
		modalView.destroy()
		modalView = null
		formView = null
	}
})
</script>

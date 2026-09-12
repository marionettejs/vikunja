<script setup lang="ts">
import {ref, watch, onMounted, onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {error} from '@/message'
import TeamService from '@/services/team'
import TeamsListView from '@/marionette/views/TeamsListView'

const router = useRouter()
const container = ref<HTMLElement | null>(null)
const isLoading = ref(true)
let view: InstanceType<typeof TeamsListView> | null = null
let isUnmounted = false
let retainedTeams: Array<{id: number, name: string}> = []

function updateDocumentTitle() {
	document.title = `${i18n.global.t('team.title')} | Vikunja`
}

function renderView() {
	if (!container.value) {
		return
	}
	updateDocumentTitle()
	if (view) {
		view.destroy()
		view = null
	}
	view = new TeamsListView({
		teams: retainedTeams,
		labels: {
			title: i18n.global.t('team.title'),
			create: i18n.global.t('team.create.title'),
			noTeams: i18n.global.t('team.noTeams'),
		},
		navigate: (path: string) => {
			router.push(path)
		},
	})
	view.render()
	container.value.replaceChildren(view.el)
}

watch(
	() => i18n.global.locale.value,
	() => {
		updateDocumentTitle()
		if (view) {
			renderView()
		}
	},
)

onMounted(async () => {
	updateDocumentTitle()
	try {
		const service = new TeamService()
		const result = await service.getAll()
		if (isUnmounted || !container.value) {
			return
		}
		retainedTeams = result.map(t => ({id: t.id!, name: t.name}))
		renderView()
	} catch (e) {
		error(e)
	} finally {
		isLoading.value = false
	}
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
	<div
		ref="container"
		class="loader-container"
		:class="{'is-loading': isLoading}"
	/>
</template>

<style lang="scss">
ul.teams {
	padding: 0;
	margin-block-start: 0;
	margin-inline-start: 0;
	border-radius: $radius;
	overflow: hidden;

	li {
		list-style: none;
		margin: 0;
		border-inline-end: 1px solid var(--grey-200);

		a {
			color: var(--text);
			display: block;
			padding: 0.5rem 1rem;
			transition: background-color $transition;

			&:hover {
				background: var(--grey-100);
			}
		}
	}

	li:last-child {
		border-inline-end: none;
	}
}
</style>

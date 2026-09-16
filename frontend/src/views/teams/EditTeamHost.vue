<script setup lang="ts">
import type {Extensions} from '@tiptap/core'
import {html} from 'lit-html'
import {ref, nextTick, onMounted, onUnmounted, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import type {ITeam} from '@/modelTypes/ITeam'
import type {ITeamMember} from '@/modelTypes/ITeamMember'
import type {IUser} from '@/modelTypes/IUser'
import {useAuthStore} from '@/stores/auth'
import {useConfigStore} from '@/stores/config'
import {i18n} from '@/i18n'
import {error, success} from '@/message'
import {PERMISSIONS} from '@/constants/permissions'
import TeamService from '@/services/team'
import TeamMemberService from '@/services/teamMember'
import UserService from '@/services/user'
import {createEditorExtensions} from '@/components/input/editor/editorExtensions'
import {TeamEditFormView} from '@/marionette/views/TeamEditFormView'
import {RichTextEditorView} from '@/marionette/views/RichTextEditorView'
import {TeamMembersView} from '@/marionette/views/TeamMembersView'
import {UserSearchView, type UserSearchOption} from '@/marionette/views/UserSearchView'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import {ConfirmTextView} from '@/marionette/views/ConfirmTextView'
import {type EditorToolbarViewInstance} from '@/marionette/views/EditorToolbarView'
import {createEditorControls, type EditorControls} from '@/marionette/views/createEditorControls'
import type {ViewInstance} from 'marionette'
import {View} from '@/marionette/index'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const configStore = useConfigStore()
const teamService = new TeamService()
const teamMemberService = new TeamMemberService()
const userService = new UserService()

const formRegion = ref<HTMLElement | null>(null)
const searchRegion = ref<HTMLElement | null>(null)
const membersRegion = ref<HTMLElement | null>(null)
const modalRegion = ref<HTMLElement | null>(null)

let formView: InstanceType<typeof TeamEditFormView> | null = null
let editorView: InstanceType<typeof RichTextEditorView> | null = null
let membersView: InstanceType<typeof TeamMembersView> | null = null
let searchView: InstanceType<typeof UserSearchView> | null = null
let activeModal: InstanceType<typeof ModalCardView> | null = null
let descriptionHostView: InstanceType<typeof TeamDescriptionEditorHostView> | null = null
let editorControls: EditorControls | null = null
let editorGeneration = 0
let syncDescriptionHostView: (() => void) | null = null
let detachDescriptionHostView: (() => void) | null = null

let isMounted = false
const currentTeam = ref<ITeam | null>(null)
let selectedUserToAdd: UserSearchOption | null = null

let savedDraftName: string | null = null
let savedDraftIsPublic: boolean | null = null
let savedDraftDescription: string | null = null

const isEditingRef = ref(true)
const contentHasChangedRef = ref(false)

interface TeamDescriptionEditorHostViewOptions {
	toolbarView: EditorToolbarViewInstance
	editorView: InstanceType<typeof RichTextEditorView>
}

const TeamDescriptionEditorHostView = View.extend({
	tagName: 'div',
	className: 'team-description-editor-host',

	regions: {
		toolbar: '.team-description-editor-toolbar',
		editor: '.team-description-editor',
	},

	template() {
		return html`
			<div class='team-description-editor-wrapper'>
				<div class='team-description-editor-toolbar'></div>
				<div class='team-description-editor'></div>
			</div>
		`
	},

	onRender() {
		const opts = this.options as TeamDescriptionEditorHostViewOptions
		this.showChildView('toolbar', opts.toolbarView)
		this.showChildView('editor', opts.editorView)
	},
}) as new (options: TeamDescriptionEditorHostViewOptions) => ViewInstance

function t(key: string, args?: Record<string, unknown>): string {
	return args ? i18n.global.t(key, args) : i18n.global.t(key)
}

function isAdmin(team: ITeam | null): boolean {
	return (team?.maxPermission ?? 0) > PERMISSIONS.READ
}

function canEditTeam(team: ITeam | null): boolean {
	return isAdmin(team) && !team?.oidcId
}

function canLeaveTeam(team: ITeam | null): boolean {
	return !team?.externalId
}

function captureDraft(): void {
	if (formView) {
		try {
			const values = formView.getValues()
			savedDraftName = values.name
			savedDraftIsPublic = values.isPublic
		} catch {
			// form may not be attached
		}
	}
	if (editorView) {
		try {
			savedDraftDescription = editorView.getContent()
		} catch {
			// editor may not be attached
		}
	}
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

function attachDescriptionHostToForm(): void {
	if (!formView || !descriptionHostView) {
		return
	}
	formView.showChildView('description', descriptionHostView)
}

function destroyViews(): void {
	destroyModal()
	// Before the form: destroying it cascades into the editor, and the controls have to
	// unregister their plugins and listeners while that editor is still alive.
	if (editorControls) {
		editorControls.destroy()
		editorControls = null
	}
	if (formView) {
		if (detachDescriptionHostView) {
			formView.off('before:render', detachDescriptionHostView)
			detachDescriptionHostView = null
		}
		if (syncDescriptionHostView) {
			formView.off('render', syncDescriptionHostView)
			syncDescriptionHostView = null
		}
		formView.destroy()
		formView = null
		descriptionHostView = null
	}
	editorView = null
	if (searchView) {
		searchView.destroy()
		searchView = null
	}
	if (membersView) {
		membersView.destroy()
		membersView = null
	}
	if (formRegion.value) {
		formRegion.value.innerHTML = ''
	}
	if (searchRegion.value) {
		searchRegion.value.innerHTML = ''
	}
	if (membersRegion.value) {
		membersRegion.value.innerHTML = ''
	}
}

function showModal(options: {
	title: string
	primaryLabel: string
	cancelLabel: string
	closeLabel: string
	bodyLines?: ReadonlyArray<string>
	onPrimary: () => void
	onClose?: () => void
}): void {
	destroyModal()
	if (!modalRegion.value) {
		return
	}
	const modal = new ModalCardView({
		title: options.title,
		primaryLabel: options.primaryLabel,
		cancelLabel: options.cancelLabel,
		closeLabel: options.closeLabel,
		onPrimary: () => {
			destroyModal()
			options.onPrimary()
		},
		onClose: () => {
			destroyModal()
			options.onClose?.()
		},
	})
	activeModal = modal
	renderModal(modal)
	// showChildView after rendering: a second render would clear the regions and
	// destroy the body view with it.
	if (options.bodyLines && options.bodyLines.length > 0) {
		modal.showChildView('body', new ConfirmTextView({lines: options.bodyLines}))
	}
}

function renderModal(modal: InstanceType<typeof ModalCardView>): void {
	modal.render()
	modalRegion.value?.appendChild(modal.el)
}

async function handleSave(values: {name: string, isPublic: boolean}): Promise<void> {
	if (!currentTeam.value) {
		return
	}
	const {isLatest, onSameTeam} = beginTeamOperation('save')
	const description = editorView ? editorView.getContent() : (currentTeam.value.description ?? '')
	formView?.setDisabled(true)
	editorView?.setEditable(false)
	try {
		const updated = await teamService.update({
			...currentTeam.value,
			name: values.name,
			isPublic: values.isPublic,
			description,
		})
		if (!isLatest()) {
			return
		}
		currentTeam.value = updated
		// A refresh already in flight read the team before this save landed, so
		// letting it commit would undo the save.
		refreshGeneration += 1
		savedDraftName = null
		savedDraftIsPublic = null
		savedDraftDescription = null
		success(t('team.edit.success'))
		document.title = `${t('team.edit.title', {name: updated.name})} | Vikunja`
	} catch (e) {
		if (!isLatest()) {
			return
		}
		error(e)
	} finally {
		if (onSameTeam()) {
			formView?.setDisabled(false)
			editorView?.setEditable(true)
		}
	}
}

function confirmDeleteTeam(): void {
	showModal({
		title: t('team.edit.delete.header'),
		primaryLabel: t('misc.delete'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		bodyLines: [t('team.edit.delete.text1'), t('team.edit.delete.text2')],
		onPrimary: async () => {
			if (!currentTeam.value) {
				return
			}
			try {
				await teamService.delete(currentTeam.value)
				if (!isMounted) {
					return
				}
				success(t('team.edit.delete.success'))
				router.push({name: 'teams.index'})
			} catch (e) {
				if (isMounted) {
					error(e)
				}
			}
		},
	})
}

function confirmRemoveMember(member: {id: number, username: string, name: string, admin: boolean}): void {
	showModal({
		title: t('team.edit.deleteUser.header', {name: member.name || member.username}),
		primaryLabel: t('misc.delete'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		bodyLines: [t('team.edit.deleteUser.text1'), t('team.edit.deleteUser.text2')],
		onPrimary: async () => {
			if (!currentTeam.value) {
				return
			}
			const targetMember = (currentTeam.value.members || []).find((m: ITeamMember) => m.username === member.username || m.id === member.id)
			if (!targetMember) {
				return
			}
			try {
				await teamMemberService.delete({
					...targetMember,
					teamId: currentTeam.value.id,
				})
				if (!isMounted) {
					return
				}
				success(t('team.edit.deleteUser.success'))
				await reloadTeam()
			} catch (e) {
				if (isMounted) {
					error(e)
				}
			}
		},
	})
}

function confirmLeaveTeam(): void {
	showModal({
		title: t('team.edit.leave.title'),
		primaryLabel: t('misc.delete'),
		cancelLabel: t('misc.cancel'),
		closeLabel: t('misc.closeDialog'),
		bodyLines: [t('team.edit.leave.text1'), t('team.edit.leave.text2')],
		onPrimary: async () => {
			const currentUser = authStore.info
			if (!currentTeam.value || !currentUser) {
				return
			}
			const myMember = (currentTeam.value.members || []).find((m: ITeamMember) => m.username === currentUser.username || m.id === currentUser.id)
			if (!myMember) {
				return
			}
			try {
				await teamMemberService.delete({
					...myMember,
					teamId: currentTeam.value.id,
				})
				if (!isMounted) {
					return
				}
				success(t('team.edit.leave.success'))
				router.push({name: 'home'})
			} catch (e) {
				if (isMounted) {
					error(e)
				}
			}
		},
	})
}

async function handleToggleAdmin(member: {id: number, username: string, admin: boolean}): Promise<void> {
	if (!currentTeam.value) {
		return
	}
	const targetMember = (currentTeam.value.members || []).find((m: ITeamMember) => m.username === member.username || m.id === member.id)
	if (!targetMember) {
		return
	}
	const newAdmin = !member.admin
	try {
		await teamMemberService.update({
			...targetMember,
			teamId: currentTeam.value.id,
			admin: newAdmin,
		})
		if (!isMounted) {
			return
		}
		success(newAdmin ? t('team.edit.madeAdmin') : t('team.edit.madeMember'))
		await reloadTeam()
	} catch (e) {
		if (isMounted) {
			error(e)
		}
	}
}

async function handleSearch(query: string, generation?: number): Promise<void> {
	if (!query || !query.trim()) {
		searchView?.setResults([], generation)
		return
	}
	try {
		const users = await userService.getAll({}, {s: query})
		if (!isMounted) {
			return
		}
		const currentUserId = authStore.info?.id
		const filtered = (users || []).filter((u: IUser) => u.id !== currentUserId)
		searchView?.setResults(filtered, generation)
	} catch (e) {
		if (isMounted) {
			error(e)
		}
	}
}

async function handleAddMember(): Promise<void> {
	if (!selectedUserToAdd) {
		error(t('team.edit.mustSelectUser'))
		return
	}
	if (!currentTeam.value) {
		return
	}
	try {
		await teamMemberService.create({
			...selectedUserToAdd,
			teamId: currentTeam.value.id,
		})
		if (!isMounted) {
			return
		}
		success(t('team.edit.userAddedSuccess'))
		selectedUserToAdd = null
		searchView?.clearSelection()
		await reloadTeam()
	} catch (e) {
		if (isMounted) {
			error(e)
		}
	}
}

let loadGeneration = 0
let refreshGeneration = 0
let saveGeneration = 0

// Route loads, member refreshes and saves all commit to currentTeam, and each
// ordering is its own: a newer refresh supersedes an older refresh, a newer save
// an older save. They are not interchangeable, so they do not share a token.
function beginTeamOperation(kind: 'refresh' | 'save') {
	const routeGeneration = loadGeneration
	const teamId = currentTeam.value?.id
	let op: number
	if (kind === 'refresh') {
		refreshGeneration += 1
		op = refreshGeneration
	} else {
		saveGeneration += 1
		op = saveGeneration
	}
	// Control state belongs to the team on screen rather than to the operation,
	// so a superseded save still re-enables the form it disabled.
	const onSameTeam = () => isMounted
		&& routeGeneration === loadGeneration
		&& currentTeam.value?.id === teamId
	return {
		onSameTeam,
		isLatest: () => onSameTeam()
			&& op === (kind === 'refresh' ? refreshGeneration : saveGeneration),
	}
}

async function reloadTeam(): Promise<void> {
	const team = currentTeam.value
	if (!team) {
		return
	}
	const {isLatest} = beginTeamOperation('refresh')
	let updatedTeam: ITeam
	try {
		updatedTeam = await teamService.get(team)
	} catch (e) {
		if (isLatest()) {
			throw e
		}
		return
	}
	if (!isLatest()) {
		return
	}
	currentTeam.value = updatedTeam
	await nextTick()
	rebuildViews()
}

function renderViews(): void {
	if (!currentTeam.value) {
		return
	}
	destroyViews()

	const currentUserId = authStore.info?.id ?? 0
	const canManage = isAdmin(currentTeam.value)
	const canEdit = canEditTeam(currentTeam.value)

	if (canEdit && formRegion.value) {
		const initialName = savedDraftName ?? currentTeam.value.name ?? ''
		const initialIsPublic = savedDraftIsPublic ?? !!currentTeam.value.isPublic
		const initialDescription = savedDraftDescription ?? currentTeam.value.description ?? ''

		formView = new TeamEditFormView({
			initialName,
			initialIsPublic,
			showPublicOption: configStore.publicTeamsEnabled,
			labels: {
				name: t('team.attributes.name'),
				namePlaceholder: t('team.attributes.namePlaceholder'),
				nameRequired: t('team.attributes.nameRequired'),
				isPublic: t('team.attributes.isPublic'),
				isPublicDescription: t('team.attributes.isPublicDescription'),
				description: t('team.attributes.description'),
				save: t('misc.save'),
				deleteTeam: t('misc.delete'),
			},
			onSave: handleSave,
			onDelete: confirmDeleteTeam,
		})

		formView.render()
		formRegion.value.appendChild(formView.el)

		const extensions: Extensions = createEditorExtensions({
			t,
			isEditing: () => isEditingRef.value,
			isEditEnabled: () => true,
			placeholder: () => t('team.attributes.descriptionPlaceholder'),
			contentHasChanged: () => contentHasChangedRef.value,
			bubbleSave: () => {},
			getEditor: () => editorView?.getEditor(),
			uploadCallback: () => undefined,
			uploadAndInsertFiles: () => {},
		})

		editorGeneration += 1
		editorView = new RichTextEditorView({
			extensions,
			content: initialDescription,
			editable: true,
			editorId: 'team-description-editor',
			ariaLabel: t('input.editor.label'),
			onChange: () => {},
		})

		editorView.render()
		const generation = editorGeneration
		editorControls = createEditorControls({
			getEditor: () => editorView?.getEditor(),
			t,
			pluginKeyPrefix: 'teamDescription',
			isActive: () => isMounted && generation === editorGeneration,
		})

		descriptionHostView = new TeamDescriptionEditorHostView({
			toolbarView: editorControls.toolbarView,
			editorView,
		})

		formView.showChildView('description', descriptionHostView)
		detachDescriptionHostView = () => {
			formView?.detachChildView('description')
		}
		syncDescriptionHostView = attachDescriptionHostToForm
		formView.on('before:render', detachDescriptionHostView)
		formView.on('render', syncDescriptionHostView)

	}

	if (canManage && searchRegion.value) {
		searchView = new UserSearchView({
			placeholder: t('team.edit.search'),
			onSearch: handleSearch,
			onSelect: (user) => {
				selectedUserToAdd = user
			},
		})
		searchView.render()
		searchRegion.value.appendChild(searchView.el)
	}

	if (membersRegion.value) {
		membersView = new TeamMembersView({
			members: currentTeam.value.members || [],
			currentUserId,
			canManage,
			labels: {
				admin: t('team.attributes.admin'),
				member: t('team.attributes.member'),
				you: 'You',
				makeAdmin: t('team.edit.makeAdmin'),
				makeMember: t('team.edit.makeMember'),
				remove: t('misc.delete'),
			},
			onToggleAdmin: handleToggleAdmin,
			onRemove: confirmRemoveMember,
		})
		membersView.render()
		membersRegion.value.appendChild(membersView.el)
	}
}

function rebuildViews(): void {
	captureDraft()
	renderViews()
}

async function loadTeam(id: number): Promise<void> {
	editorGeneration += 1
	loadGeneration += 1
	const generation = loadGeneration
	try {
		const team = await teamService.get({id} as ITeam)
		if (!isMounted || generation !== loadGeneration) {
			return
		}
		currentTeam.value = team
		document.title = `${t('team.edit.title', {name: team.name})} | Vikunja`
		await nextTick()
		renderViews()
	} catch (e) {
		if (isMounted && generation === loadGeneration) {
			error(e)
		}
	}
}

watch(() => i18n.global.locale.value, () => {
	if (currentTeam.value) {
		document.title = `${t('team.edit.title', {name: currentTeam.value.name})} | Vikunja`
		rebuildViews()
	}
})

watch(() => route.params.id, (newId) => {
	if (!newId || !isMounted) {
		return
	}
	savedDraftName = null
	savedDraftIsPublic = null
	savedDraftDescription = null
	loadTeam(Number(newId))
})

onMounted(async () => {
	isMounted = true
	const id = Number(route.params.id)
	await loadTeam(id)
})

onUnmounted(() => {
	isMounted = false
	destroyViews()
})
</script>

<template>
	<div class="team-edit-host">
		<div
			v-if="currentTeam && canEditTeam(currentTeam)"
			ref="formRegion"
			class="team-edit-form-region mb-6"
		/>
		<div class="card team-members-card">
			<header class="card-header">
				<p class="card-header-title">
					{{ t('team.edit.members') }}
				</p>
			</header>
			<div class="card-content">
				<div
					v-if="currentTeam && isAdmin(currentTeam)"
					class="add-member-control is-flex is-align-items-center mb-4"
				>
					<div
						ref="searchRegion"
						class="is-flex-grow-1 mr-2"
					/>
					<button
						type="button"
						class="button is-primary"
						@click="handleAddMember"
					>
						{{ t('team.edit.addUser') }}
					</button>
				</div>
				<div
					ref="membersRegion"
					class="team-members-region"
				/>
			</div>
		</div>
		<div
			v-if="currentTeam && canLeaveTeam(currentTeam)"
			class="leave-team-section mt-6"
		>
			<button
				type="button"
				class="button is-danger is-outlined"
				@click="confirmLeaveTeam"
			>
				{{ t('team.edit.leave.title') }}
			</button>
		</div>
		<div ref="modalRegion" />
	</div>
</template>

<style lang="scss">
// The Marionette search control renders outside Vue, so scoped styles never reach it.
// These mirror the dropdown rows the replaced multiselect produced.
.team-edit-host {
	.multiselect {
		position: relative;
		inline-size: 100%;
	}

	.search-results {
		position: absolute;
		inset-inline: 0;
		inline-size: 100%;
		box-sizing: border-box;
		z-index: 100;
		max-block-size: 20rem;
		overflow-y: auto;
		background: var(--white);
		border-radius: $radius;
		box-shadow: var(--shadow-sm);
	}

	.search-result-item {
		display: block;
		inline-size: 100%;
		box-sizing: border-box;
		font-family: inherit;
		font-size: 1rem;
		line-height: 1.5;
		padding: 0.5rem 1rem;
		text-align: start;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text);

		&:hover,
		&:focus {
			background: var(--grey-100);
		}
	}
}

.mn-image-alt-menu,
.mn-editor-bubble {
	z-index: 4600;
	background: var(--white);
	border-radius: $radius;
	box-shadow: var(--shadow-md);
	overflow: hidden;

	&__wrapper {
		display: flex;
	}

	&__button {
		font-family: inherit;
		font-size: 1rem;
		line-height: 1;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text);

		&:hover,
		&:focus {
			background: var(--grey-100);
		}

		&.is-active {
			background: var(--primary);
			color: var(--white);
		}
	}
}

.team-description-editor-wrapper {
	display: flex;
	flex-direction: column;
	gap: .5rem;
}

.mn-editor-toolbar {
	background: var(--white);
	border: 1px solid var(--grey-200);
	user-select: none;
	padding: .5rem;
	border-radius: $radius;
	display: flex;
	flex-wrap: wrap;

	> * + * {
		border-inline-start: 1px solid var(--grey-200);
		margin-inline-start: 6px;
		padding-inline-start: 6px;
	}
}

.mn-editor-toolbar__button {
	min-inline-size: 2rem;
	block-size: 2rem;
	border-radius: $radius;
	border: 1px solid transparent;
	color: var(--grey-700);
	transition: all $transition;
	background: transparent;
	margin-inline-end: .25rem;

	&:hover {
		background: var(--grey-100);
		border-color: var(--grey-200);
	}

	&.is-active {
		background: var(--primary);
		color: var(--white);
	}

	.icon {
		position: relative;

		.icon__lower-text {
			font-size: .75rem;
			position: absolute;
			inset-block-end: -3px;
			inset-inline-end: -2px;
			font-weight: bold;
		}
	}
}

.mn-editor-toolbar__table-buttons {
	margin-block-start: .5rem;

	> .mn-editor-toolbar__button {
		margin-inline-end: .5rem;
		margin-block-end: .5rem;
		padding: 0 .25rem;
		border: 1px solid var(--grey-400);
		font-size: .75rem;
		block-size: 1.5rem;
	}
}
.mn-image-alt-menu__button {
	padding: .375rem .75rem;
	border: 0;
	border-radius: $radius;
	background: transparent;
	color: var(--grey-900);
	cursor: pointer;

	&:hover,
	&:focus-visible {
		background: var(--grey-200);
	}
}
</style>

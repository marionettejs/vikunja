<script setup lang="ts">
import type {Extensions} from '@tiptap/core'
import {ref, onMounted, onUnmounted, watch} from 'vue'
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

let isMounted = false
let currentTeam: ITeam | null = null
let selectedUserToAdd: UserSearchOption | null = null

let savedDraftName: string | null = null
let savedDraftIsPublic: boolean | null = null
let savedDraftDescription: string | null = null

const isEditingRef = ref(true)
const contentHasChangedRef = ref(false)

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

function destroyViews(): void {
	destroyModal()
	if (formView) {
		formView.destroy()
		formView = null
	}
	if (editorView) {
		editorView.destroy()
		editorView = null
	}
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
}

function renderModal(modal: InstanceType<typeof ModalCardView>): void {
	modal.render()
	modalRegion.value?.appendChild(modal.el)
}

async function handleSave(values: {name: string, isPublic: boolean}): Promise<void> {
	if (!currentTeam) {
		return
	}
	const description = editorView ? editorView.getContent() : (currentTeam.description ?? '')
	formView?.setDisabled(true)
	editorView?.setEditable(false)
	try {
		const updated = await teamService.update({
			...currentTeam,
			name: values.name,
			isPublic: values.isPublic,
			description,
		})
		if (!isMounted) {
			return
		}
		currentTeam = updated
		savedDraftName = null
		savedDraftIsPublic = null
		savedDraftDescription = null
		success(t('team.edit.success'))
		document.title = `${t('team.edit.title', {name: updated.name})} | Vikunja`
	} catch (e) {
		if (!isMounted) {
			return
		}
		error(e)
	} finally {
		if (isMounted) {
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
		onPrimary: async () => {
			if (!currentTeam) {
				return
			}
			try {
				await teamService.delete(currentTeam)
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
		onPrimary: async () => {
			if (!currentTeam) {
				return
			}
			const targetMember = (currentTeam.members || []).find((m: ITeamMember) => m.username === member.username || m.id === member.id)
			if (!targetMember) {
				return
			}
			try {
				await teamMemberService.delete({
					...targetMember,
					teamId: currentTeam.id,
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
		onPrimary: async () => {
			const currentUser = authStore.info
			if (!currentTeam || !currentUser) {
				return
			}
			const myMember = (currentTeam.members || []).find((m: ITeamMember) => m.username === currentUser.username || m.id === currentUser.id)
			if (!myMember) {
				return
			}
			try {
				await teamMemberService.delete({
					...myMember,
					teamId: currentTeam.id,
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
	if (!currentTeam) {
		return
	}
	const targetMember = (currentTeam.members || []).find((m: ITeamMember) => m.username === member.username || m.id === member.id)
	if (!targetMember) {
		return
	}
	const newAdmin = !member.admin
	try {
		await teamMemberService.update({
			...targetMember,
			teamId: currentTeam.id,
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

async function handleSearch(query: string): Promise<void> {
	if (!query || !query.trim()) {
		searchView?.setResults([])
		return
	}
	try {
		const users = await userService.getAll({}, {s: query})
		if (!isMounted) {
			return
		}
		const currentUserId = authStore.info?.id
		const filtered = (users || []).filter((u: IUser) => u.id !== currentUserId)
		searchView?.setResults(filtered)
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
	if (!currentTeam) {
		return
	}
	try {
		await teamMemberService.create({
			...selectedUserToAdd,
			teamId: currentTeam.id,
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

async function reloadTeam(): Promise<void> {
	if (!currentTeam) {
		return
	}
	const team = await teamService.get(currentTeam)
	if (!isMounted) {
		return
	}
	currentTeam = team
	rebuildViews()
}

function renderViews(): void {
	if (!currentTeam) {
		return
	}
	destroyViews()

	const currentUserId = authStore.info?.id ?? 0
	const canManage = isAdmin(currentTeam)
	const canEdit = canEditTeam(currentTeam)

	if (canEdit && formRegion.value) {
		const initialName = savedDraftName ?? currentTeam.name ?? ''
		const initialIsPublic = savedDraftIsPublic ?? !!currentTeam.isPublic
		const initialDescription = savedDraftDescription ?? currentTeam.description ?? ''

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
			isEditing: isEditingRef,
			isEditEnabled: () => true,
			placeholder: t('team.attributes.descriptionPlaceholder'),
			contentHasChanged: contentHasChangedRef,
			bubbleSave: () => {},
			getEditor: () => undefined,
			uploadCallback: undefined,
			uploadAndInsertFiles: () => {},
		})

		editorView = new RichTextEditorView({
			extensions,
			content: initialDescription,
			editable: true,
			editorId: 'team-description-editor',
			ariaLabel: t('input.editor.label'),
			onChange: () => {},
		})

		editorView.render()
		formView.showChildView('description', editorView)
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
			members: currentTeam.members || [],
			currentUserId,
			canManage,
			labels: {
				admin: t('team.attributes.admin'),
				member: t('team.attributes.member'),
				you: t('team.attributes.member'),
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

watch(() => i18n.global.locale, () => {
	if (currentTeam) {
		document.title = `${t('team.edit.title', {name: currentTeam.name})} | Vikunja`
		rebuildViews()
	}
})

onMounted(async () => {
	isMounted = true
	const id = Number(route.params.id)
	try {
		const team = await teamService.get({id} as ITeam)
		if (!isMounted) {
			return
		}
		currentTeam = team
		document.title = `${t('team.edit.title', {name: team.name})} | Vikunja`
		renderViews()
	} catch (e) {
		if (isMounted) {
			error(e)
		}
	}
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

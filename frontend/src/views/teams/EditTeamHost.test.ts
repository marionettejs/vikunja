import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {mount, flushPromises, type VueWrapper} from '@vue/test-utils'
import StarterKit from '@tiptap/starter-kit'
import EditTeamHost from './EditTeamHost.vue'

let capturedOptions: any = null

const {mockGetTeam, mockUpdateTeam, mockDeleteTeam} = vi.hoisted(() => ({
	mockGetTeam: vi.fn(),
	mockUpdateTeam: vi.fn(),
	mockDeleteTeam: vi.fn(),
}))

const {mockGetMembers, mockCreateMember, mockUpdateMember, mockDeleteMember} = vi.hoisted(() => ({
	mockGetMembers: vi.fn(),
	mockCreateMember: vi.fn(),
	mockUpdateMember: vi.fn(),
	mockDeleteMember: vi.fn(),
}))

const {mockGetAllUsers} = vi.hoisted(() => ({
	mockGetAllUsers: vi.fn(),
}))

const {mockError, mockSuccess, mockPush, mockBack} = vi.hoisted(() => ({
	mockError: vi.fn(),
	mockSuccess: vi.fn(),
	mockPush: vi.fn(),
	mockBack: vi.fn(),
}))

const {routeParams} = await vi.hoisted(async () => {
	const {reactive} = await import('vue')
	return {
		routeParams: reactive({id: '42'}),
	}
})

vi.mock('@/services/team', () => ({
	default: class {
		get(model: any) {
			return mockGetTeam(model)
		}
		update(model: any) {
			return mockUpdateTeam(model)
		}
		delete(model: any) {
			return mockDeleteTeam(model)
		}
	},
}))

vi.mock('@/services/teamMember', () => ({
	default: class {
		getAll(model: any) {
			return mockGetMembers(model)
		}
		create(model: any) {
			return mockCreateMember(model)
		}
		update(model: any) {
			return mockUpdateMember(model)
		}
		delete(model: any) {
			return mockDeleteMember(model)
		}
	},
}))

vi.mock('@/services/user', () => ({
	default: class {
		getAll(params: any, query: any) {
			return mockGetAllUsers(params, query)
		}
	},
}))

vi.mock('@/message', () => ({
	error: mockError,
	success: mockSuccess,
}))

vi.mock('vue-router', () => ({
	useRoute: () => ({
		params: routeParams,
	}),
	useRouter: () => ({
		push: mockPush,
		back: mockBack,
	}),
}))

vi.mock('@/i18n', async () => {
	const {ref} = await import('vue')
	return {
		i18n: {
			global: {
				t: (key: string, args?: Record<string, any>) => {
					if (args?.name) {
						return `${key}:${args.name}`
					}
					return key
				},
				locale: ref('en'),
			},
		},
	}
})

vi.mock('@/stores/auth', () => ({
	useAuthStore: () => ({
		info: {
			id: 1,
			username: 'testuser',
		},
	}),
}))

vi.mock('@/stores/config', () => ({
	useConfigStore: () => ({
		publicTeamsEnabled: true,
	}),
}))

vi.mock('@/components/input/editor/editorExtensions', () => ({
	createEditorExtensions: (options: any) => {
		capturedOptions = options
		return [StarterKit]
	},
}))

describe('EditTeamHost', () => {
	let wrapper: VueWrapper | null = null

	beforeEach(() => {
		capturedOptions = null
		routeParams.id = '42'
		mockGetTeam.mockReset()
		mockUpdateTeam.mockReset()
		mockDeleteTeam.mockReset()
		mockGetMembers.mockReset()
		mockCreateMember.mockReset()
		mockUpdateMember.mockReset()
		mockDeleteMember.mockReset()
		mockGetAllUsers.mockReset()
		mockError.mockReset()
		mockSuccess.mockReset()
		mockPush.mockReset()
		mockBack.mockReset()

		mockGetTeam.mockResolvedValue({
			id: 42,
			name: 'Test Team',
			description: '<p>Initial team description</p>',
			isPublic: false,
			maxPermission: 2, // Admin permission (> PERMISSIONS.READ)
			oidcId: null, // canEditTeam = true
			externalId: null,
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
			],
		})
	})

	afterEach(() => {
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it('passes a getEditor callback that resolves to the live editor once the editor view is rendered', async () => {
		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		expect(typeof capturedOptions?.getEditor).toBe('function')
		const editor = capturedOptions.getEditor()
		expect(editor).not.toBeUndefined()
		expect(editor.view.dom).toBeInstanceOf(HTMLElement)
		expect(document.body.contains(editor.view.dom)).toBe(true)
	})

	it('getEditor reports no editor once the host is unmounted', async () => {
		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		expect(capturedOptions?.getEditor()).toBeDefined()

		wrapper.unmount()
		wrapper = null

		expect(capturedOptions.getEditor()).toBeUndefined()
	})

	it('attaches a bubble menu carrying the six formatting controls', async () => {
		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		const buttons = document.body.querySelectorAll('.mn-editor-bubble__button')
		expect(buttons).toHaveLength(6)

		const commands = Array.from(buttons).map(btn => btn.getAttribute('data-command'))
		expect(commands).toEqual(['bold', 'italic', 'underline', 'strike', 'code', 'link'])
	})

	it('removes the bubble menu from the document when the host unmounts', async () => {
		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		expect(document.body.querySelector('.mn-editor-bubble')).not.toBeNull()

		wrapper.unmount()
		wrapper = null

		expect(document.body.querySelector('.mn-editor-bubble')).toBeNull()
	})

	it('shows the bubble menu only once there is a selection in the editor', async () => {
		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		const bubble = document.body.querySelector<HTMLElement>('.mn-editor-bubble')
		expect(bubble).not.toBeNull()
		expect(bubble!.style.visibility).not.toBe('visible')

		const editor = capturedOptions.getEditor()
		expect(editor).toBeDefined()

		editor.view.dom.focus()
		editor.commands.focus()
		editor.commands.selectAll()

		await vi.waitFor(
			() => expect(bubble!.style.visibility).toBe('visible'),
			{timeout: 2000, interval: 20},
		)
	})

	function makeTeam42() {
		return {
			id: 42,
			name: 'Team 42',
			description: '<p>Team 42 description</p>',
			isPublic: false,
			maxPermission: 2,
			oidcId: null,
			externalId: null,
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
				{
					id: 2,
					username: 'otheruser',
					name: 'Other User',
					admin: false,
				},
			],
		}
	}

	function installDeferredGetTeam() {
		const deferredGets: Array<{
			id?: number
			resolve: (team: any) => void
			reject: (err: any) => void
		}> = []
		mockGetTeam.mockImplementation((model?: {id: number}) => {
			return new Promise((resolve, reject) => {
				deferredGets.push({id: model?.id, resolve, reject})
			})
		})
		return deferredGets
	}

	it('a member refresh in flight does not replace the team the route navigated to', async () => {
		const deferredGets = installDeferredGetTeam()

		const team42 = makeTeam42()

		const team99 = {
			id: 99,
			name: 'Team 99',
			description: '<p>Team 99 description</p>',
			isPublic: false,
			maxPermission: 2,
			oidcId: null,
			externalId: null,
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
			],
		}

		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		// Settle team 42 initial load
		const initialGet42 = deferredGets.find(d => d.id === 42)
		expect(initialGet42).toBeDefined()
		initialGet42!.resolve(team42)
		await flushPromises()

		// Form view has team 42
		const inputBefore = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputBefore.element.value).toBe('Team 42')
		expect(document.title).toContain('Team 42')

		// Start navigation to team 99
		routeParams.id = '99'
		await flushPromises()
		const get99 = deferredGets.find(d => d.id === 99)
		expect(get99).toBeDefined()

		// Trigger member mutation refresh on team 42
		mockUpdateMember.mockResolvedValue({})
		const toggleAdminBtn = document.body.querySelector<HTMLButtonElement>('button.toggle-admin')
		expect(toggleAdminBtn).not.toBeNull()
		toggleAdminBtn!.click()
		await flushPromises()

		// Settle team 99 first
		get99!.resolve(team99)
		await flushPromises()

		expect(document.title).toContain('Team 99')
		const inputAfterNav = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputAfterNav.element.value).toBe('Team 99')

		// Now settle the member reload for team 42
		const reloadGet42 = deferredGets.find(d => d.id === 42 && d !== initialGet42)
		expect(reloadGet42).toBeDefined()
		reloadGet42!.resolve({
			...team42,
			name: 'Team 42 Reloaded',
		})
		await flushPromises()

		// Assert team 99 is still on screen and document title remains Team 99
		const inputFinal = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputFinal.element.value).toBe('Team 99')
		expect(document.title).toContain('Team 99')
	})

	it('an older member refresh that resolves last does not overwrite the newer one', async () => {
		const deferredGets = installDeferredGetTeam()

		const team42 = makeTeam42()

		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		// Initial load call is deferredGets[0]
		expect(deferredGets).toHaveLength(1)
		deferredGets[0].resolve(team42)
		await flushPromises()

		const inputInitial = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputInitial.element.value).toBe('Team 42')

		mockUpdateMember.mockResolvedValue({})

		const toggleAdminBtn = document.body.querySelector<HTMLButtonElement>('button.toggle-admin')
		expect(toggleAdminBtn).not.toBeNull()

		// Click toggle-admin to start refresh A
		toggleAdminBtn!.click()
		await flushPromises()
		// deferredGets[1] is refresh A
		expect(deferredGets).toHaveLength(2)

		// Click toggle-admin again to start refresh B
		toggleAdminBtn!.click()
		await flushPromises()
		// deferredGets[2] is refresh B
		expect(deferredGets).toHaveLength(3)

		// Settle refresh B first with 'Team 42 Newer' (member 2 is admin)
		deferredGets[2].resolve({
			...team42,
			name: 'Team 42 Newer',
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
				{
					id: 2,
					username: 'otheruser',
					name: 'Other User',
					admin: true,
				},
			],
		})
		await flushPromises()

		const member2RowAfterNewer = document.body.querySelector('tr[data-member-id="2"]')
		expect(member2RowAfterNewer).not.toBeNull()
		expect(member2RowAfterNewer?.textContent).toContain('team.attributes.admin')
		expect(member2RowAfterNewer?.querySelector('button.toggle-admin')?.textContent?.trim()).toBe('team.edit.makeMember')

		// Settle refresh A last with 'Team 42 Older' (member 2 is regular member)
		deferredGets[1].resolve({
			...team42,
			name: 'Team 42 Older',
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
				{
					id: 2,
					username: 'otheruser',
					name: 'Other User',
					admin: false,
				},
			],
		})
		await flushPromises()

		// The older refresh resolving last must NOT overwrite the newer one
		const member2RowFinal = document.body.querySelector('tr[data-member-id="2"]')
		expect(member2RowFinal).not.toBeNull()
		expect(member2RowFinal?.textContent).toContain('team.attributes.admin')
		expect(member2RowFinal?.querySelector('button.toggle-admin')?.textContent?.trim()).toBe('team.edit.makeMember')
	})

	it('a pending refresh cannot carry the previous team drafts onto the newly loaded team', async () => {
		const deferredGets = installDeferredGetTeam()

		const team42 = makeTeam42()

		const team99 = {
			id: 99,
			name: 'Team 99',
			description: '<p>Team 99 description</p>',
			isPublic: false,
			maxPermission: 2,
			oidcId: null,
			externalId: null,
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
			],
		}

		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		// Settle team 42 initial load
		expect(deferredGets).toHaveLength(1)
		const initialGet42 = deferredGets[0]
		initialGet42.resolve(team42)
		await flushPromises()

		const input = wrapper.find<HTMLInputElement>('#teamtext')
		expect(input.element.value).toBe('Team 42')

		// Type into the team name input so there is an unsaved draft
		input.element.value = 'Draft Name Never Saved'
		input.element.dispatchEvent(new Event('input', {bubbles: true}))
		await flushPromises()

		// Start a member refresh
		mockUpdateMember.mockResolvedValue({})
		const toggleAdminBtn = document.body.querySelector<HTMLButtonElement>('button.toggle-admin')
		expect(toggleAdminBtn).not.toBeNull()
		toggleAdminBtn!.click()
		await flushPromises()
		// deferredGets[1] is the member refresh for team 42
		expect(deferredGets).toHaveLength(2)

		// While that refresh is pending, navigate by setting the reactive route id to '99'
		routeParams.id = '99'
		await flushPromises()
		// deferredGets[2] is the load for team 99
		expect(deferredGets).toHaveLength(3)

		// Settle the pending refresh for team 42
		deferredGets[1].resolve({
			...team42,
			name: 'Team 42 Reloaded',
		})
		await flushPromises()

		// Settle the load for team 99 with a team named 'Team 99'
		deferredGets[2].resolve(team99)
		await flushPromises()

		// Assert the #teamtext input value is 'Team 99' — NOT 'Draft Name Never Saved', and not 'Team 42'
		const finalInput = wrapper.find<HTMLInputElement>('#teamtext')
		expect(finalInput.element.value).toBe('Team 99')
	})

	function installDeferredUpdateTeam() {
		const deferredUpdates: Array<{
			model?: any
			resolve: (team: any) => void
			reject: (err: any) => void
		}> = []
		mockUpdateTeam.mockImplementation((model?: any) => {
			return new Promise((resolve, reject) => {
				deferredUpdates.push({model, resolve, reject})
			})
		})
		return deferredUpdates
	}

	it('a save that resolves after navigation does not restore the previous team', async () => {
		const deferredGets = installDeferredGetTeam()
		const deferredUpdates = installDeferredUpdateTeam()

		const team42 = makeTeam42()
		const team99 = {
			id: 99,
			name: 'Team 99',
			description: '<p>Team 99 description</p>',
			isPublic: false,
			maxPermission: 2,
			oidcId: null,
			externalId: null,
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
			],
		}

		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		// Settle team 42
		expect(deferredGets).toHaveLength(1)
		deferredGets[0].resolve(team42)
		await flushPromises()

		// Type a new name into #teamtext and trigger save so teamService.update is in flight
		const input = wrapper.find<HTMLInputElement>('#teamtext')
		expect(input.element.value).toBe('Team 42')
		input.element.value = 'Team 42 Renamed'
		input.element.dispatchEvent(new Event('input', {bubbles: true}))
		await flushPromises()

		const saveButton = document.body.querySelector<HTMLButtonElement>('button.save-button')
		expect(saveButton).not.toBeNull()
		saveButton!.click()
		await flushPromises()

		expect(deferredUpdates).toHaveLength(1)

		// Navigate by setting the reactive route id to '99', and settle the load for team 99
		routeParams.id = '99'
		await flushPromises()

		expect(deferredGets).toHaveLength(2)
		deferredGets[1].resolve(team99)
		await flushPromises()

		// Now settle the pending update for team 42
		deferredUpdates[0].resolve({
			...team42,
			name: 'Team 42 Renamed',
		})
		await flushPromises()

		// Assert #teamtext still reads 'Team 99' and document.title still refers to team 99
		const inputFinal = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputFinal.element.value).toBe('Team 99')
		expect(document.title).toContain('Team 99')
	})

	it('a failed save of the previous team does not raise an error on the new team', async () => {
		const deferredGets = installDeferredGetTeam()
		const deferredUpdates = installDeferredUpdateTeam()

		const team42 = makeTeam42()
		const team99 = {
			id: 99,
			name: 'Team 99',
			description: '<p>Team 99 description</p>',
			isPublic: false,
			maxPermission: 2,
			oidcId: null,
			externalId: null,
			members: [
				{
					id: 1,
					username: 'testuser',
					name: 'Test User',
					admin: true,
				},
			],
		}

		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		// Settle team 42
		expect(deferredGets).toHaveLength(1)
		deferredGets[0].resolve(team42)
		await flushPromises()

		// Type a new name into #teamtext and trigger save so teamService.update is in flight
		const input = wrapper.find<HTMLInputElement>('#teamtext')
		expect(input.element.value).toBe('Team 42')
		input.element.value = 'Team 42 Failed Rename'
		input.element.dispatchEvent(new Event('input', {bubbles: true}))
		await flushPromises()

		const saveButton = document.body.querySelector<HTMLButtonElement>('button.save-button')
		expect(saveButton).not.toBeNull()
		saveButton!.click()
		await flushPromises()

		expect(deferredUpdates).toHaveLength(1)

		// Navigate by setting the reactive route id to '99', and settle the load for team 99
		routeParams.id = '99'
		await flushPromises()

		expect(deferredGets).toHaveLength(2)
		deferredGets[1].resolve(team99)
		await flushPromises()

		// Reject the pending update
		deferredUpdates[0].reject(new Error('Save failed'))
		await flushPromises()

		// Assert the mocked error reporter was NOT called after navigation
		expect(mockError).not.toHaveBeenCalled()
	})
})

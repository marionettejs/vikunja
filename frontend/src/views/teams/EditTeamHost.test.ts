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

		const buttons = document.body.querySelectorAll('.editor-bubble__button')
		expect(buttons).toHaveLength(6)

		const commands = Array.from(buttons).map(btn => btn.getAttribute('data-command'))
		expect(commands).toEqual(['bold', 'italic', 'underline', 'strike', 'code', 'link'])
	})

	it('removes the bubble menu from the document when the host unmounts', async () => {
		wrapper = mount(EditTeamHost, {
			attachTo: document.body,
		})
		await flushPromises()

		expect(document.body.querySelector('.editor-bubble')).not.toBeNull()

		wrapper.unmount()
		wrapper = null

		expect(document.body.querySelector('.editor-bubble')).toBeNull()
	})

	it('shows the bubble menu only once there is a selection in the editor', async () => {
		vi.useFakeTimers()
		try {
			wrapper = mount(EditTeamHost, {
				attachTo: document.body,
			})
			await flushPromises()

			const bubble = document.body.querySelector<HTMLElement>('.editor-bubble')
			expect(bubble).not.toBeNull()
			expect(bubble!.style.visibility).not.toBe('visible')

			const editor = capturedOptions.getEditor()
			expect(editor).toBeDefined()

			editor.view.dom.focus()
			editor.commands.focus()
			editor.commands.selectAll()

			vi.advanceTimersByTime(300)
			await flushPromises()

			expect(bubble!.style.visibility).toBe('visible')
		} finally {
			vi.useRealTimers()
		}
	})

	it('a member refresh in flight does not replace the team the route navigated to', async () => {
		const deferreds: Record<number, {resolve: (team: any) => void, reject: (err: any) => void}> = {}

		mockGetTeam.mockImplementation((model: {id: number}) => {
			return new Promise((resolve, reject) => {
				deferreds[model.id] = {resolve, reject}
			})
		})

		const team42 = {
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
		expect(deferreds[42]).toBeDefined()
		deferreds[42].resolve(team42)
		await flushPromises()

		// Form view has team 42
		const inputBefore = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputBefore.element.value).toBe('Team 42')
		expect(document.title).toContain('Team 42')

		// Start navigation to team 99
		routeParams.id = '99'
		await flushPromises()
		expect(deferreds[99]).toBeDefined()

		// Trigger member mutation refresh on team 42
		mockUpdateMember.mockResolvedValue({})
		const toggleAdminBtn = document.body.querySelector<HTMLButtonElement>('button.toggle-admin')
		expect(toggleAdminBtn).not.toBeNull()
		toggleAdminBtn!.click()
		await flushPromises()

		// Settle team 99 first
		deferreds[99].resolve(team99)
		await flushPromises()

		expect(document.title).toContain('Team 99')
		const inputAfterNav = wrapper.find<HTMLInputElement>('#teamtext')
		expect(inputAfterNav.element.value).toBe('Team 99')

		// Now settle the member reload for team 42
		deferreds[42].resolve({
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
		const deferredGets: Array<{resolve: (team: any) => void, reject: (err: any) => void}> = []

		mockGetTeam.mockImplementation(() => {
			return new Promise((resolve, reject) => {
				deferredGets.push({resolve, reject})
			})
		})

		const team42 = {
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
})

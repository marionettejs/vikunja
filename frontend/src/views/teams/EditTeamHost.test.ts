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
		params: {
			id: '42',
		},
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
				t: (key: string) => key,
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
})

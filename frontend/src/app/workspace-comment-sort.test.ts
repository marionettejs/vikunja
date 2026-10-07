import {afterEach, expect, it, vi} from 'vitest'
import {WorkspaceApplication} from './workspace'
import {SessionApplication} from './session'
import UserModel from '@/models/user'
import type {IUserSettings} from '@/modelTypes/IUserSettings'

const updateSettings = vi.hoisted(() => vi.fn())
vi.mock('@/services/userSettings', () => ({default: class {update = updateSettings}}))
let workspace: InstanceType<typeof WorkspaceApplication> | undefined
let session: InstanceType<typeof SessionApplication> | undefined
afterEach(() => {workspace?.destroy(); session?.destroy(); updateSettings.mockReset()})
function setup() {
	const user = new UserModel({id: 1, username: 'sort-owner'})
	user.settings.frontendSettings.commentSortOrder = 'asc'
	session = new SessionApplication()
	session.getState().set({status: 'authenticated', user})
	workspace = new WorkspaceApplication({session, navigate: vi.fn()})
	const comments = workspace.taskPorts(workspace.widgets().context).comments(1)
	let finish!: (settings: IUserSettings) => void
	updateSettings.mockImplementationOnce(() => new Promise<IUserSettings>(resolve => {finish = resolve}))
	return {user, comments, finish: () => finish(updateSettings.mock.calls[0][0]), caller: new AbortController()}
}

it('a held sort preference save updates its initiating user normally', async () => {
	const {user, comments, finish, caller} = setup()
	const pending = comments.sort('desc', caller.signal)
	finish()
	await pending
	expect.soft(user.settings.frontendSettings.commentSortOrder).toBe('desc')
	expect(updateSettings).toHaveBeenCalledOnce()
	expect(updateSettings.mock.calls[0][1]).toBe(caller.signal)
})
for (const change of ['logout', 'replacement', 'transition', 'caller-abort'] as const) {
	it(`a held sort preference save cannot publish after ${change}`, async () => {
		const {user, comments, finish, caller} = setup()
		const replacement = new UserModel({id: 2, username: 'replacement-owner'})
		replacement.settings.frontendSettings.commentSortOrder = 'asc'
		const replacementSettings = replacement.settings
		const originalSettings = user.settings
		const pending = comments.sort('desc', caller.signal).catch((error: unknown) => error)
		if (change === 'caller-abort') caller.abort()
		else {
			session!.getState().set('transition', 1)
			if (change === 'logout') session!.getState().set({status: 'anonymous', user: null})
			else if (change === 'replacement') session!.getState().set('user', replacement)
			workspace!.stop()
		}
		finish()
		const result = await pending
		expect.soft(result).toBeInstanceOf(DOMException)
		expect.soft(result instanceof DOMException ? result.name : undefined).toBe('AbortError')
		expect.soft(user.settings).toBe(originalSettings)
		expect.soft(user.settings.frontendSettings.commentSortOrder).toBe('asc')
		expect.soft(replacement.settings).toBe(replacementSettings)
		expect.soft(replacement.settings.frontendSettings.commentSortOrder).toBe('asc')
	})
}

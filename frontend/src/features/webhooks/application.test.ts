import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import UserModel, * as users from '@/models/user'
import WebhookModel from '@/models/webhook'
import {WebhookManagerView} from './application'

let region: InstanceType<typeof Region> | undefined

afterEach(() => {
	region?.destroy()
	vi.useRealTimers()
	vi.restoreAllMocks()
	document.body.replaceChildren()
})
function mount(user = new UserModel({id: 1, username: 'creator', name: 'Webhook Creator'}), container = document.body) {
	const host = document.createElement('div')
	container.append(host)
	region = new Region({el: host})
	const record = new WebhookModel({id: 1, targetUrl: 'https://fixture.invalid/webhook', created: new Date('2026-10-06'), createdBy: user})
	const view = new WebhookManagerView({editable: true, current: () => true, data: {records: [record], events: []}})
	region.show(view)
	return {view, host}
}
it('CreatedBy renders a decorative 25px avatar beside its display name', async () => {
	const stop = vi.fn()
	vi.spyOn(users, 'observeAvatar').mockReturnValue(stop)
	const fetch = vi.spyOn(users, 'fetchAvatarBlobUrl').mockResolvedValue('blob:creator-avatar')
	const {host} = mount()
	await vi.waitFor(() => expect(host.querySelector('.avatar')?.getAttribute('src')).toBe('blob:creator-avatar'))
	expect(fetch).toHaveBeenCalledWith({username: 'creator'}, 25)
	const image = host.querySelector('img.avatar')!
	expect(image.getAttribute('width')).toBe('25')
	expect(image.getAttribute('height')).toBe('25')
	expect(image.getAttribute('alt')).toBe('')
	expect(host.querySelector('.username')?.textContent).toBe('Webhook Creator')
	expect((host.querySelector('.user') as HTMLElement).style.getPropertyValue('--avatar-size')).toBe('25px')
})
it('removing a webhook destroys its avatar observer and discards late avatar completion', async () => {
	let finish!: (url: string) => void
	const stop = vi.fn()
	vi.spyOn(users, 'observeAvatar').mockReturnValue(stop)
	vi.spyOn(users, 'fetchAvatarBlobUrl').mockReturnValue(new Promise(resolve => {finish = resolve}))
	const {view, host} = mount()
	const placeholder = host.querySelector('.user-avatar-placeholder')!
	expect(placeholder.getAttribute('aria-hidden')).toBe('true')
	view.getState().records.remove(1)
	expect(stop).toHaveBeenCalledOnce()
	finish('blob:late-avatar')
	await Promise.resolve()
	expect(host.querySelector('tbody')?.children).toHaveLength(0)
	expect(host.querySelector('img.avatar')).toBeNull()
})
it('avatar invalidation updates only the row avatar and bot creators retain their badge', async () => {
	let changed!: () => void
	vi.spyOn(users, 'observeAvatar').mockImplementation((_name, callback) => {changed = callback; return vi.fn()})
	const fetch = vi.spyOn(users, 'fetchAvatarBlobUrl').mockResolvedValue('blob:first-avatar')
	const {host} = mount(new UserModel({id: 2, username: 'bot-creator', name: 'Webhook Bot', botOwnerId: 1}))
	await vi.waitFor(() => expect(host.querySelector('img.avatar')).not.toBeNull())
	const row = host.querySelector('tbody tr')!, username = host.querySelector('.username')!
	fetch.mockResolvedValue('blob:updated-avatar')
	changed()
	await vi.waitFor(() => expect(host.querySelector('img.avatar')?.getAttribute('src')).toBe('blob:updated-avatar'))
	expect(host.querySelector('tbody tr')).toBe(row)
	expect(host.querySelector('.username')).toBe(username)
	expect(host.querySelector('.bot-badge')?.getAttribute('aria-label')).toBe('Bot')
	expect(username.textContent).toBe('Webhook Bot')
})

async function hoverableCreator(container = document.body) {
	const stop = vi.fn()
	let changed!: () => void
	vi.spyOn(users, 'observeAvatar').mockImplementation((_name, callback) => {changed = callback; return stop})
	vi.spyOn(users, 'fetchAvatarBlobUrl').mockResolvedValue('blob:creator-avatar')
	const mounted = mount(new UserModel({id: 2, username: 'bot-creator', name: 'Webhook Bot', botOwnerId: 1}), container)
	await vi.waitFor(() => expect(mounted.host.querySelector('img.avatar')).not.toBeNull())
	vi.useFakeTimers()
	return {...mounted, stop, changed}
}
function enter(element: Element) { element.dispatchEvent(new MouseEvent('mouseenter')) }
function leave(element: Element) { element.dispatchEvent(new MouseEvent('mouseleave')) }
it('creator avatar and bot badge reuse the original hover tooltip text and dismiss on leave or click', async () => {
	const {host} = await hoverableCreator()
	const avatar = host.querySelector('[data-avatar]')!, badge = host.querySelector('.bot-badge')!
	enter(avatar)
	vi.advanceTimersByTime(199)
	expect(document.querySelector('[role=tooltip]')).toBeNull()
	vi.advanceTimersByTime(1)
	expect(document.querySelector('[role=tooltip]')?.textContent).toBe('Webhook Bot')
	leave(avatar)
	expect(document.querySelector('[role=tooltip]')).toBeNull()
	enter(badge)
	vi.advanceTimersByTime(200)
	expect(document.querySelector('[role=tooltip]')?.textContent).toBe('Bot')
	badge.dispatchEvent(new MouseEvent('click', {bubbles: true}))
	expect(document.querySelector('[role=tooltip]')).toBeNull()
})
it.each(['pending', 'shown'] as const)('removing a creator row cleans its %s tooltip and observer', async phase => {
	const {view, host, stop} = await hoverableCreator()
	enter(host.querySelector('[data-avatar]')!)
	if (phase === 'shown') {
		vi.advanceTimersByTime(200)
		expect(document.querySelector('[role=tooltip]')).not.toBeNull()
	}
	view.getState().records.remove(1)
	vi.advanceTimersByTime(200)
	expect(stop).toHaveBeenCalledOnce()
	expect(document.querySelector('[role=tooltip]')).toBeNull()
	expect(host.querySelector('tbody')?.children).toHaveLength(0)
})
it('avatar invalidation dismisses a stale anchor tooltip while retaining the row and username', async () => {
	const {host, changed} = await hoverableCreator()
	const row = host.querySelector('tr')!, username = host.querySelector('.username')!
	enter(host.querySelector('[data-avatar]')!)
	vi.advanceTimersByTime(200)
	expect(document.querySelector('[role=tooltip]')).not.toBeNull()
	changed()
	expect(document.querySelector('[role=tooltip]')).toBeNull()
	await Promise.resolve()
	expect(host.querySelector('tr')).toBe(row)
	expect(host.querySelector('.username')).toBe(username)
})
it('creator tooltip belongs to its open project dialog and is removed with the manager Region', async () => {
	const dialog = document.createElement('dialog')
	dialog.setAttribute('open', '')
	document.body.append(dialog)
	const {host} = await hoverableCreator(dialog)
	enter(host.querySelector('[data-avatar]')!)
	vi.advanceTimersByTime(200)
	expect(dialog.querySelector('[role=tooltip]')?.textContent).toBe('Webhook Bot')
	region!.empty()
	expect(document.querySelector('[role=tooltip]')).toBeNull()
})

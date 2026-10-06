import { Application, View, CollectionView } from 'marionette'
import { Model, Collection, DataApi } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import NotificationService from '@/services/notification'
import NotificationModel from '@/models/notification'
import { NOTIFICATION_NAMES as names } from '@/modelTypes/INotification'
import { getDisplayName, fetchAvatarBlobUrl, observeAvatar } from '@/models/user'
import { formatDateLong, displayDate } from '../../shared/dates'
import type { IUser } from '@/modelTypes/IUser'
const NotificationRow = Model<{
    id: number;
    notification: NotificationModel;
}>
import { EditorAvatarView } from '@/shared/editor/editor-avatar'
import { listIcon } from '@/shared/task-list/list-ui'
import type { SessionApplication } from '../../app/session'
import type { WorkspaceRealtime } from '../../app/realtime'
import { t } from '../../shared/i18n'
import { success, errorText } from '../../shared/notifications'
import './application.scss'
export function notificationHref(notification: NotificationModel): string | undefined {
	const payload = notification.notification
	switch (notification.name) {
		case names.TASK_COMMENT:
		case names.TASK_ASSIGNED:
		case names.TASK_REMINDER:
		case names.TASK_MENTIONED:
		case names.TASK_CREATED: return payload.task ? `/tasks/${payload.task.id}` : undefined
		case names.PROJECT_CREATED: return payload.project ? `/projects/${payload.project.id}` : undefined
		case names.TEAM_MEMBER_ADDED: return payload.team ? `/teams/${payload.team.id}/edit` : undefined
	}
}
interface Options {
    session: InstanceType<typeof SessionApplication>;
    realtime: WorkspaceRealtime;
    navigate: (href: string) => void;
}
export const NotificationApplication = Application.extend({
	initialize(options: Options) { void options },
	createState() { return { model: new Model({ loading: false, busy: false, error: '' }) as Model<{loading: boolean, busy: boolean, error: string}>, rows: new Collection<InstanceType<typeof NotificationRow>>() as Collection<Model<{id: number, notification: NotificationModel}>>, requests: new Set<AbortController>(), read: undefined as AbortController | undefined, publication: 0, identity: undefined as unknown, transition: 0, poll: undefined as ReturnType<typeof setInterval> | undefined, stops: [] as (() => void)[] } },
	onStart() {
		const state = this.getState()
		state.identity = this.options.session.getState().get('user')
		state.transition = this.options.session.getState().get('transition') ?? 0
		this.setView(new NotificationCenterView({ controller: this }))
		this.showView()
		state.stops = [this.options.realtime.subscribe('notification.created', message => { if (!this.current() || !message.data)
			return; try {
			const notification = new NotificationModel(message.data as Partial<NotificationModel>)
			if (notification.name && !state.rows.get(notification.id)) {
				state.publication++
				state.rows.add(new NotificationRow({ id: notification.id, notification }))
				state.rows.move(notification.id, 0)
			}
		}
		catch (error) {
			state.model.set('error', errorText(error))
		} }), this.options.realtime.observeConnection(connected => { if (!connected && this.current())
			void this.load() })]
		state.poll = setInterval(() => { if (this.current() && !this.options.realtime.connected && document.visibilityState === 'visible')
			void this.load() }, 10000)
		void this.load()
	},
	current() { return this.isRunning() && this.options.session.getState().get('user') === this.getState().identity && this.options.session.getState().get('transition') === this.getState().transition },
	async load() {
		if (!this.current())
			return
		const state = this.getState(), request = new AbortController(), revision = state.publication
		state.read?.abort()
		state.read = request
		state.requests.add(request)
		state.model.set({ loading: true, error: '' })
		try {
			const notifications = await new NotificationService().getAll(undefined, {}, 1, request.signal) as NotificationModel[]
			request.signal.throwIfAborted()
			if (!this.current() || state.read !== request)
				return
			const incoming = notifications.filter(n => n.name).map(notification => ({ id: notification.id, notification }))
			if (revision === state.publication) {
				const ids = new Set(incoming.map(item => item.id))
				state.rows.remove(state.rows.models.filter(row => !ids.has(row.get('id')!)).map(row => row.id))
				for (const [index, item] of incoming.entries()) {
					const row = state.rows.get(item.id)
					if (row)
						row.set('notification', item.notification)
					else
						state.rows.add(item)
					state.rows.move(item.id, index)
				}
			}
			else
				for (const item of incoming)
					if (!state.rows.get(item.id))
						state.rows.add(item)
		}
		catch (error) {
			if (!request.signal.aborted && this.current() && state.read === request)
				state.model.set('error', errorText(error))
		}
		finally {
			state.requests.delete(request)
			if (state.read === request) {
				state.read = undefined
				if (this.current())
					state.model.set('loading', false)
			}
		}
	},
	async mutate(kind: 'read' | 'all' | 'clear', notification?: NotificationModel) {
		const state = this.getState()
		if (state.model.get('busy') || !this.current())
			return false
		const request = new AbortController(), ids = state.rows.models.map(model => model.id)
		state.requests.add(request)
		state.model.set({ busy: true, error: '' })
		try {
			const service = new NotificationService()
			if (kind === 'read') {
				const saved = await service.update(new NotificationModel({ ...notification, read: true }), request.signal)
				request.signal.throwIfAborted()
				if (!this.current())
					return false
				state.rows.get(notification!.id)?.set('notification', new NotificationModel(saved))
			}
			else if (kind === 'all') {
				await service.markAllRead(request.signal)
				request.signal.throwIfAborted()
				if (!this.current())
					return false
				for (const id of ids) {
					const row = state.rows.get(id)
					if (row)
						row.set('notification', new NotificationModel({ ...row.get('notification'), readAt: new Date() }))
				}
				;
				success(t('notification.markAllReadSuccess'))
			}
			else {
				await service.delete(new NotificationModel({}), request.signal)
				request.signal.throwIfAborted()
				if (!this.current())
					return false
				state.rows.remove(ids)
				success(t('notification.clearAllSuccess'))
			}
			state.publication++
			state.read?.abort()
			return true
		}
		catch (error) {
			if (!request.signal.aborted && this.current())
				state.model.set('error', errorText(error))
			return false
		}
		finally {
			state.requests.delete(request)
			if (this.current())
				state.model.set('busy', false)
		}
	},
	async select(notification: NotificationModel) { if (this.getState().model.get('busy'))
		return false; const href = notificationHref(notification); if (!href)
		return false; this.options.navigate(href); return this.mutate('read', notification) },
	onBeforeStop() { const state = this.getState(); clearInterval(state.poll); for (const stop of state.stops)
		stop(); state.stops = []; for (const request of state.requests)
		request.abort(); state.requests.clear(); state.read = undefined; state.rows.reset([]);state.model.set({loading:false,busy:false,error:''}); state.publication++ },
})
const NotificationRowView = View.extend({
	model: undefined as InstanceType<typeof NotificationRow> | undefined,
	initialize(options: {
        controller: InstanceType<typeof NotificationApplication>;
        select: (notification: NotificationModel) => void;
    }) { void options; this.listenTo(this.model!, 'change', this.render) },
	tagName: 'button', className: 'single-notification base-button base-button--type-button', attributes: { type: 'button' }, regions: { avatar: '[data-avatar]' },
	events: { click: 'select' },
	templateContext() { return { notification: this.model!.get('notification') as NotificationModel, user: this.options.controller.options.session.getState().get('user')! } },
	template: ({ notification, user }: {
        notification: NotificationModel;
        user: IUser;
    }) => html `<span class="read-indicator ${notification.readAt ? 'read' : ''}"></span>${notification.notification.doer ? html `<span class="user" data-avatar></span>` : nothing}<span class="detail"><span>${notification.notification.doer ? html `<strong class="mie-1">${getDisplayName(notification.notification.doer)}</strong>` : nothing}${notification.toText(user)}</span><br><span class="created" title=${formatDateLong(notification.created)}>${displayDate(notification.created, user.settings.frontendSettings)}</span></span>`,
	onRender() { const notification = this.model!.get('notification') as NotificationModel; this.el.classList.toggle('is-clickable', Boolean(notificationHref(notification))); this.el.setAttribute('aria-disabled', String(!notificationHref(notification))); const user = notification.notification.doer; if (user)
		this.showChildView('avatar', new EditorAvatarView({ user, size: 16, imageClass: 'avatar', context: { avatar: (username, size) => fetchAvatarBlobUrl({ username }, size), observeAvatar } })) },
	select() { this.options.select(this.model!.get('notification') as NotificationModel) },
}).setDomApi(LitDomApi).setDataApi(DataApi)
const NotificationRows = CollectionView.extend({ childView: NotificationRowView }).setDataApi(DataApi)
const NotificationCenterView = View.extend({
	initialize(options: {
        controller: InstanceType<typeof NotificationApplication>;
    }) { void options; this.listenTo(options.controller.getState().model, 'change', this.publish); this.listenTo(options.controller.getState().rows, 'update reset change', this.publish) },
	className: 'notifications native-list-surface', regions: { rows: '[data-rows]' }, ui: { trigger: '[data-trigger]', popup: '[data-popup]', indicator: '.unread-indicator', all: '[data-all]', clear: '[data-clear]', empty: '[data-empty]', error: '[data-error]', loading: '[data-loading]' },
	events: { 'click @ui.trigger': 'toggle', 'click @ui.all': 'markAll', 'click @ui.clear': 'clear', 'click [data-retry]': 'retry', 'click [data-feed]': 'feed' },
	createState() { return { open: false, epoch: 0, outside: (event: MouseEvent) => { if (!event.composedPath().includes(this.el))
		this.close() }, key: (event: KeyboardEvent) => { if (event.key === 'Escape' && this.getState().open) {
		event.preventDefault()
		this.close();
		(this.getUI('trigger')![0] as HTMLButtonElement).focus()
	} } } },
	template: () => html `<button type="button" class="base-button base-button--type-button trigger-button" data-trigger aria-expanded="false" aria-label=${t('notification.title')}><span class="unread-indicator" hidden></span>${listIcon('bell')}</button><div class="notifications-list" data-popup hidden><div class="head"><span>${t('notification.title')}</span><span class="actions"><button type="button" data-clear class="base-button action-link" aria-label=${t('notification.clearAll')}>${listIcon('check-double')}</button><a data-feed href="/user/settings/feeds" class="base-button action-link" aria-label=${t('notification.subscribeFeed')}>${listIcon('rss')}</a></span></div><div data-loading role="status" hidden>${t('misc.loading')}</div><div data-error class="message danger" role="alert" hidden></div><div data-rows></div><button type="button" data-all class="base-button button is-text is-inverted underline-none has-no-shadow mbs-2 is-fullwidth">${t('notification.markAllRead')}</button><p data-empty class="nothing">${t('notification.none')}<br><span class="explainer">${t('notification.explainer')}</span></p></div>`,
	onAttach() { this.showChildView('rows', new NotificationRows({ collection: this.options.controller.getState().rows, childViewOptions: () => ({ controller: this.options.controller, select: (notification: NotificationModel) => void this.select(notification) }) })); document.addEventListener('click', this.getState().outside); document.addEventListener('keydown', this.getState().key); this.publish() },
	toggle(event: MouseEvent) { event.stopPropagation(); const state = this.getState(); state.open = !state.open; state.epoch++; this.publish() },
	close() { this.getState().open = false; this.getState().epoch++; this.publish() },
	publish() { if (!this.isRendered() || this.isDestroyed())
		return; const state = this.options.controller.getState(), rows = state.rows.models.map(model => model.get('notification') as NotificationModel), unread = rows.some(row => !row.readAt); (this.getUI('popup')![0] as HTMLElement).hidden = !this.getState().open; (this.getUI('trigger')![0] as HTMLElement).setAttribute('aria-expanded', String(this.getState().open)); (this.getUI('indicator')![0] as HTMLElement).hidden = !unread; (this.getUI('empty')![0] as HTMLElement).hidden = rows.length > 0 || Boolean(state.model.get('loading')) || Boolean(state.model.get('error')); (this.getUI('all')![0] as HTMLButtonElement).hidden = !unread; (this.getUI('clear')![0] as HTMLButtonElement).hidden = !rows.length; for (const name of ['all', 'clear'])
		(this.getUI(name)![0] as HTMLButtonElement).disabled = Boolean(state.model.get('busy')); (this.getUI('loading')![0] as HTMLElement).hidden = !state.model.get('loading'); const error = this.getUI('error')![0] as HTMLElement; error.hidden = !state.model.get('error'); error.replaceChildren(); if (!error.hidden) {
		error.append(document.createTextNode(state.model.get('error') ?? ''))
		const retry = document.createElement('button')
		retry.type = 'button'
		retry.dataset.retry = ''
		retry.className = 'base-button button is-outlined'
		retry.textContent = t('loadingError.tryAgain')
		error.append(retry)
	} },
	async select(notification: NotificationModel) { const epoch = this.getState().epoch; if (await this.options.controller.select(notification) && !this.isDestroyed() && this.getState().epoch === epoch)
		this.close() },
	markAll() { void this.options.controller.mutate('all') }, clear() { void this.options.controller.mutate('clear') }, retry() { void this.options.controller.load() },
	feed(event: MouseEvent) { event.preventDefault(); this.close(); this.options.controller.options.navigate('/user/settings/feeds') },
	onBeforeDestroy() { document.removeEventListener('click', this.getState().outside); document.removeEventListener('keydown', this.getState().key) },
}).setDomApi(LitDomApi)

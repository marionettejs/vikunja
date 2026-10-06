import type UserModel from '@/models/user'
import { Application, View } from 'marionette'
import { Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import {WorkspaceRealtime,type RealtimeMessage} from '../../app/realtime'
import { useTimeEntryService, parseTimeEntry } from '@/services/timeEntry'
import type { ITimeEntry } from '@/modelTypes/ITimeEntry'
import type { SessionApplication } from '../../app/session'
import { featureEnabled } from '../admin/application'
import { PRO_FEATURE } from '@/constants/proFeatures'
import { t } from '../../shared/i18n'
import { interceptLink } from '../../app/routes'
import { reportError } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
export const TimerApplication = Application.extend({
	initialize(options: {
		session: InstanceType<typeof SessionApplication>;
		navigate: (href: string) => void;
		realtime?: WorkspaceRealtime;
	}) {
		void options
	},
	createState() {
		return {
			model: new Model({ active: null as ITimeEntry | null, pending: false }) as Model<{active: ITimeEntry | null, pending: boolean}>,
			requests: new Set<AbortController>(),
			realtime:this.options.realtime??new WorkspaceRealtime(this.options.session),
			identity: null as UserModel | null,
			transition: 0,
			hydration: undefined as AbortController | undefined,
			subscriptions: [] as (() => void)[],
		}
	},
	onStart() {
		this.getState().requests = new Set<AbortController>()
		if (!featureEnabled(this.options.session, PRO_FEATURE.TIME_TRACKING))
			return
		this.getState().identity =
			this.options.session.getState().get('user') ?? null
		this.getState().transition =
			this.options.session.getState().get('transition') ?? 0
		this.setView(
			new TimerBadgeView({ controller: this, navigate: this.options.navigate }),
		)
		this.showView()
		void this.hydrate()
		this.connect()
	},
	current() {
		return (
			this.isRunning() &&
			this.options.session.getState().get('user') ===
				this.getState().identity &&
			this.options.session.getState().get('transition') ===
				this.getState().transition
		)
	},
	async hydrate() {
		const request = new AbortController()
		this.getState().hydration?.abort()
		this.getState().hydration = request
		this.getState().requests.add(request)
		try {
			const { items } = await useTimeEntryService().getAll(
				{
					filter: `user_id = ${this.getState().identity!.id} && end_time = null`,
					perPage: 1,
				},
				request.signal,
			)
			request.signal.throwIfAborted()
			if (this.current() && this.getState().hydration === request)
				this.getState().model.set('active', items[0] ?? null)
		} catch (error) {
			if (!request.signal.aborted && this.current()) reportError(error)
		} finally {
			this.getState().requests.delete(request)
		}
	},
	accept(entry: ITimeEntry) {
		if (!this.current()) return
		this.getState().hydration?.abort()
		if (entry.userId === this.getState().identity!.id) {
			if (!entry.endTime) this.getState().model.set('active', entry)
			else if (this.getState().model.get('active')?.id === entry.id)
				this.getState().model.set('active', null)
		}
		this.trigger('entry:updated', entry)
	},
	deleted(id: number) {
		if (!this.current()) return
		this.getState().hydration?.abort()
		if (this.getState().model.get('active')?.id === id)
			this.getState().model.set('active', null)
		this.trigger('entry:deleted', id)
	},
	async stopTimer() {
		if (this.getState().model.get('pending')) return
		const request = new AbortController()
		this.getState().requests.add(request)
		this.getState().model.set('pending', true)
		try {
			const entry = await useTimeEntryService().stopTimer(request.signal)
			request.signal.throwIfAborted()
			if (this.current()) this.accept(entry)
		} catch (error) {
			if (!request.signal.aborted && this.current()) reportError(error)
		} finally {
			this.getState().requests.delete(request)
			if (this.current()) this.getState().model.set('pending', false)
		}
	},
	connect() {
		const realtime:WorkspaceRealtime=this.getState().realtime
		this.getState().subscriptions=[...['timer.created','timer.updated','timer.deleted'].map(event=>realtime.subscribe(event,(message:RealtimeMessage)=>{if(!this.current()||!message.data)return;if(message.event==='timer.deleted')this.deleted(parseTimeEntry(message.data as Record<string,unknown>).id);else this.accept(parseTimeEntry(message.data as Record<string,unknown>))})),realtime.observeConnection((connected:boolean)=>{if(connected&&this.current())void this.hydrate()})]
	},
	onBeforeStop() {
		for (const request of this.getState().requests ?? []) request.abort()
		for(const stop of this.getState().subscriptions)stop();this.getState().subscriptions=[]
		this.getState().model.set({ active: null, pending: false })
	},
})
const TimerBadgeView = View.extend({
	initialize(options: {
		controller: InstanceType<typeof TimerApplication>;
		navigate: (href: string) => void;
	}) {
		void options
		this.listenTo(options.controller.getState().model, 'change', this.publish)
	},
	createState() {
		return {
			interval: undefined as ReturnType<typeof setInterval> | undefined,
		}
	},
	template: () => html`<div data-badge></div>`,
	onAttach() {
		this.publish()
		this.getState().interval = setInterval(() => this.publish(), 1000)
	},
	publish() {
		if (this.isDestroyed()) return
		const state = this.options.controller.getState().model,
			entry = state.get('active'),
			seconds = entry
				? Math.max(0, Math.floor((Date.now() - +entry.startTime) / 1000))
				: 0,
			pad = (n: number) => String(n).padStart(2, '0'),
			elapsed = `${seconds >= 3600 ? `${Math.floor(seconds / 3600)}:` : ''}${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
		render(
			entry
				? html`<div class="timer-badge" data-cy="timerBadge">
						<a
							class="timer-badge__elapsed"
							href="/time-tracking"
							title=${t('timeTracking.title')}
							@click=${(event: MouseEvent) =>
		interceptLink(event, this.options.navigate)}
							>${elapsed}</a
						><button
							type="button"
							class="base-button timer-badge__stop"
							data-cy="stopTimer"
							aria-label=${t('timeTracking.stop')}
							?disabled=${state.get('pending')}
							@click=${() => void this.options.controller.stopTimer()}
						>
							${listIcon('stop')}
						</button>
					</div>`
				: nothing,
			this.el.querySelector('[data-badge]')!,
		)
	},
	onBeforeDestroy() {
		clearInterval(this.getState().interval)
	},
}).setDomApi(LitDomApi)

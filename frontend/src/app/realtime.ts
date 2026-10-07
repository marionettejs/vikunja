import { getToken } from '@/helpers/auth'
import type { SessionApplication } from './session'
export interface RealtimeMessage {
    event?: string;
    action?: string;
    success?: boolean;
    error?: string;
    data?: unknown;
}
export class WorkspaceRealtime {
	private socket?: WebSocket
	private attempt = 0
	private retry?: ReturnType<typeof setTimeout>
	private subscriptions = new Map<string, Set<(message: RealtimeMessage) => void>>()
	private connectionListeners = new Set<(connected: boolean) => void>()
	private identity: unknown
	private transition = 0
	connected = false
	constructor(private session: InstanceType<typeof SessionApplication>) { }
	subscribe(event: string, callback: (message: RealtimeMessage) => void) {
		const listeners = this.subscriptions.get(event) ?? new Set()
		listeners.add(callback)
		this.subscriptions.set(event, listeners)
		if (this.connected)
			this.socket?.send(JSON.stringify({ action: 'subscribe', event }))
		if (!this.socket && !this.retry) {
			this.identity = this.session.getState().get('user')
			this.transition = this.session.getState().get('transition') ?? 0
			this.connect()
		}
		return () => { listeners.delete(callback); if (!listeners.size) {
			this.subscriptions.delete(event)
			if (this.connected)
				this.socket?.send(JSON.stringify({ action: 'unsubscribe', event }))
		} if (!this.subscriptions.size)
			this.stop() }
	}
	observeConnection(callback: (connected: boolean) => void) { this.connectionListeners.add(callback); return () => this.connectionListeners.delete(callback) }
	private current(socket?: WebSocket) { return this.subscriptions.size > 0 && this.session.getState().get('user') === this.identity && this.session.getState().get('transition') === this.transition && (!socket || this.socket === socket) }
	private publish(connected: boolean) { if (this.connected === connected)
		return; this.connected = connected; for (const listener of this.connectionListeners)
		listener(connected) }
	private reconnect() { if (!this.current())
		return; clearTimeout(this.retry); this.retry = setTimeout(() => {this.retry=undefined;this.connect()}, Math.round(Math.min(1000 * 2 ** this.attempt++, 30000) * (.75 + Math.random() * .5))) }
	private connect() {
		if (this.socket || !this.current() || !getToken())
			return
		let socket: WebSocket
		try {
			socket = new WebSocket(window.API_URL.replace(/\/+$/, '').replace(/^http/, 'ws') + '/ws')
		}
		catch {
			this.reconnect()
			return
		}
		this.socket = socket
		socket.onopen = () => { if (this.current(socket))
			socket.send(JSON.stringify({ action: 'auth', token: getToken() })) }
		socket.onmessage = event => {
			if (!this.current(socket))
				return
			let message: RealtimeMessage
			try {
				message = JSON.parse(event.data)
			}
			catch {
				return
			}
			if (message.error === 'invalid_token' || message.error === 'auth_required') {
				socket.onclose = null
				socket.close()
				this.socket = undefined
				this.publish(false)
				return
			}
			if (message.action === 'auth.success' && message.success) {
				this.attempt = 0
				this.publish(true)
				for (const event of this.subscriptions.keys())
					socket.send(JSON.stringify({ action: 'subscribe', event }))
				return
			}
			if (message.event)
				for (const callback of this.subscriptions.get(message.event) ?? [])
					callback(message)
		}
		socket.onclose = () => { if (!this.current(socket))
			return; this.socket = undefined; this.publish(false); this.reconnect() }
	}
	stop() { clearTimeout(this.retry); this.retry = undefined; const socket = this.socket; this.socket = undefined; if (socket) {
		socket.onopen = null
		socket.onmessage = null
		socket.onclose = null
		socket.close()
	} this.publish(false); this.attempt = 0 }
}

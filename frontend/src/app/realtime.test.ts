import { afterEach, expect, it, vi } from 'vitest';
import { SessionApplication } from './session';
import { WorkspaceRealtime } from './realtime';
import UserModel from '@/models/user';
import { saveToken, removeToken } from '@/helpers/auth';
class Socket {
    static instances: Socket[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: {
        data: string;
    }) => void) | null = null;
    onclose: (() => void) | null = null;
    sent: string[] = [];
    close = vi.fn();
    constructor(readonly url: string) { Socket.instances.push(this); }
    send(value: string) { this.sent.push(value); }
    receive(value: object) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const owners: Array<{
    destroy: () => unknown;
} | {
    stop: () => unknown;
}> = [];
afterEach(() => { for (const owner of owners.splice(0)) {
    if ('destroy' in owner)
        owner.destroy();
    else
        owner.stop();
} ; removeToken(); vi.useRealTimers(); vi.unstubAllGlobals(); Socket.instances = []; });
function transport() {
    vi.stubGlobal('WebSocket', Socket);
    window.API_URL = 'http://localhost:3456/api/v1/';
    saveToken('local-fixture-token', false);
    const session = new SessionApplication();
    session.getState().set({ user: new UserModel({ id: 1 }), transition: 1 });
    owners.push(session);
    const realtime = new WorkspaceRealtime(session);
    owners.push(realtime);
    return { session, realtime };
}
it('notification and timer subscribers share authentication and own separate event lifetimes', () => {
    const { realtime } = transport(), notification = vi.fn(), timer = vi.fn();
    const stopNotifications = realtime.subscribe('notification.created', notification), stopTimer = realtime.subscribe('timer.updated', timer);
    expect(Socket.instances).toHaveLength(1);
    const socket = Socket.instances[0];
    expect(socket.url).toBe('ws://localhost:3456/api/v1/ws');
    socket.onopen?.();
    expect(JSON.parse(socket.sent[0])).toEqual({ action: 'auth', token: 'local-fixture-token' });
    expect(realtime.connected).toBe(false);
    socket.receive({ action: 'auth.success', success: true });
    expect(realtime.connected).toBe(true);
    expect(socket.sent.slice(1).map(value => JSON.parse(value).event)).toEqual(['notification.created', 'timer.updated']);
    socket.receive({ event: 'notification.created', data: { id: 1 } });
    expect(notification).toHaveBeenCalledOnce();
    expect(timer).not.toHaveBeenCalled();
    stopNotifications();
    expect(socket.close).not.toHaveBeenCalled();
    socket.receive({ event: 'notification.created', data: { id: 2 } });
    expect(notification).toHaveBeenCalledOnce();
    socket.receive({ event: 'timer.updated', data: { id: 3 } });
    expect(timer).toHaveBeenCalledOnce();
    stopTimer();
    expect(socket.close).toHaveBeenCalledOnce();
    expect(realtime.connected).toBe(false);
});
it('reconnect authenticates and resubscribes while stop cancels pending reconnect', () => {
    vi.useFakeTimers();
    const { realtime } = transport();
    const stop = realtime.subscribe('notification.created', vi.fn());
    const first = Socket.instances[0];
    first.receive({ action: 'auth.success', success: true });
    first.onclose?.();
    expect(realtime.connected).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(Socket.instances).toHaveLength(2);
    const next = Socket.instances[1];
    next.onopen?.();
    next.receive({ action: 'auth.success', success: true });
    expect(next.sent.map(value => JSON.parse(value).action)).toEqual(['auth', 'subscribe']);
    next.onclose?.();
    stop();
    vi.advanceTimersByTime(40000);
    expect(Socket.instances).toHaveLength(2);
});
it.each(['invalid_token', 'auth_required'])('%s stops without retrying a rejected token', error => {
    vi.useFakeTimers();
    const { realtime } = transport();
    realtime.subscribe('notification.created', vi.fn());
    const socket = Socket.instances[0];
    socket.receive({ error });
    vi.advanceTimersByTime(40000);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(Socket.instances).toHaveLength(1);
    expect(realtime.connected).toBe(false);
});
it('a prior identity cannot publish messages or reconnect', () => {
    vi.useFakeTimers();
    const { session, realtime } = transport(), receive = vi.fn();
    realtime.subscribe('notification.created', receive);
    const socket = Socket.instances[0];
    session.getState().set({ user: new UserModel({ id: 2 }), transition: 2 });
    socket.receive({ action: 'auth.success', success: true });
    socket.receive({ event: 'notification.created', data: { id: 1 } });
    socket.onclose?.();
    vi.advanceTimersByTime(40000);
    expect(receive).not.toHaveBeenCalled();
    expect(realtime.connected).toBe(false);
    expect(Socket.instances).toHaveLength(1);
});
it('a subscription during reconnect cannot open a second concurrent socket',()=>{
 vi.useFakeTimers();const {realtime}=transport()
 realtime.subscribe('notification.created',vi.fn());Socket.instances[0].onclose?.()
 realtime.subscribe('timer.updated',vi.fn());expect(Socket.instances).toHaveLength(1)
 vi.advanceTimersByTime(1500);expect(Socket.instances).toHaveLength(2)
 Socket.instances[1].receive({action:'auth.success',success:true})
 expect(Socket.instances[1].sent.map(value=>JSON.parse(value).event)).toEqual(['notification.created','timer.updated'])
})

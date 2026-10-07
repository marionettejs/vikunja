import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { NotificationApplication, notificationHref } from './application';
import { SessionApplication } from '../../app/session';
import { WorkspaceRealtime, type RealtimeMessage } from '../../app/realtime';
import UserModel from '@/models/user';
import NotificationModel from '@/models/notification';
import NotificationService from '@/services/notification';
import ProjectModel from '@/models/project';
const owners: Array<{
    destroy: () => unknown;
}> = [];
afterEach(() => { for (const owner of owners.splice(0))
    owner.destroy(); vi.restoreAllMocks(); document.body.replaceChildren(); });
async function start() {
    const session = new SessionApplication();
    session.getState().set({ user: new UserModel({ id: 1 }), transition: 1 });
    owners.push(session);
    const realtime = new WorkspaceRealtime(session);
    let publish!: (message: RealtimeMessage) => void;
    const unsubscribe = vi.fn();
    vi.spyOn(realtime, 'subscribe').mockImplementation((_event, callback) => { publish = callback; return unsubscribe; });
    vi.spyOn(realtime, 'observeConnection').mockReturnValue(vi.fn());
    const el = document.createElement('div');
    document.body.append(el);
    const region = new Region({ el });
    owners.push(region);
    const app = new NotificationApplication({ session, realtime, navigate: vi.fn() });
    owners.push(app);
    await app.start({ region });
    return { app, session, publish, unsubscribe };
}
function notification(id: number) { return new NotificationModel({ id, name: 'task.created', notification: { task: { id: 10, index: id, identifier: '', title: 'task' } }, created: new Date('2026-01-01') }); }
it('a realtime notification survives an older REST list and duplicate delivery', async () => {
    let resolve!: (rows: NotificationModel[]) => void;
    vi.spyOn(NotificationService.prototype, 'getAll').mockImplementation(() => new Promise(ready => resolve = ready));
    const { app, publish } = await start();
    publish({ event: 'notification.created', data: notification(2) });
    publish({ event: 'notification.created', data: notification(2) });
    resolve([notification(1)]);
    await vi.waitFor(() => expect(app.getState().model.get('loading')).toBe(false));
    expect(app.getState().rows.models.map(row => row.id)).toEqual([2, 1]);
    expect(document.querySelectorAll('.single-notification')).toHaveLength(2);
});
it.each(['all', 'clear'] as const)('%s does not erase a notification delivered after the request snapshot', async (kind) => {
    vi.spyOn(NotificationService.prototype, 'getAll').mockResolvedValue([notification(1)]);
    let resolve!: (value: unknown) => void;
    const write = vi.spyOn(NotificationService.prototype, kind === 'all' ? 'markAllRead' : 'delete').mockImplementation(() => new Promise(ready => resolve = ready));
    const { app, publish } = await start();
    await vi.waitFor(() => expect(app.getState().rows.length).toBe(1));
    const pending = app.mutate(kind);
    publish({ event: 'notification.created', data: notification(2) });
    resolve({});
    await pending;
    expect(write).toHaveBeenCalledOnce();
    expect(app.getState().rows.get(2)?.get('notification')?.readAt).toBeNull();
    if (kind === 'all')
        expect(app.getState().rows.get(1)?.get('notification')?.readAt).toBeInstanceOf(Date);
    else
        expect(app.getState().rows.get(1)).toBeUndefined();
});
it.each(['stop', 'identity'] as const)('%s rejects an ignored abort response and websocket publication', async (reason) => {
    let resolve!: (rows: NotificationModel[]) => void, signal: AbortSignal | undefined;
    vi.spyOn(NotificationService.prototype, 'getAll').mockImplementation((_model, _params, _page, requestSignal) => { signal = requestSignal; return new Promise(ready => resolve = ready); });
    const { app, session, publish, unsubscribe } = await start();
    if (reason === 'stop')
        app.stop();
    else
        session.getState().set({ user: new UserModel({ id: 2 }), transition: 2 });
    resolve([notification(1)]);
    publish({ event: 'notification.created', data: notification(2) });
    await Promise.resolve();
    await Promise.resolve();
    expect(app.getState().rows.length).toBe(0);
    if (reason === 'stop') {
        expect(signal?.aborted).toBe(true);
        expect(unsubscribe).toHaveBeenCalledOnce();
    }
});
it('project and team notifications use supported routes and deleted tasks have no route', () => {
    expect(notificationHref(new NotificationModel({ name: 'project.created', notification: { project: new ProjectModel({ id: 5, title: 'project' }) } }))).toBe('/projects/5');
    expect(notificationHref(new NotificationModel({ name: 'team.member.added', notification: { team: { id: 8, name: 'team' } } }))).toBe('/teams/8/edit');
    expect(notificationHref(new NotificationModel({ name: 'task.deleted', notification: { task: { id: 2, index: 1, identifier: '', title: 'task' } } }))).toBeUndefined();
});
it('stop clears a pending mutation so restarting the owner cannot retain its busy state',async()=>{
 vi.spyOn(NotificationService.prototype,'getAll').mockResolvedValue([notification(1)])
 let resolve!:(value:unknown)=>void
 vi.spyOn(NotificationService.prototype,'markAllRead').mockImplementation(()=>new Promise(ready=>resolve=ready))
 const {app}=await start();await vi.waitFor(()=>expect(app.getState().rows.length).toBe(1))
 const pending=app.mutate('all');expect(app.getState().model.get('busy')).toBe(true)
 app.stop();expect(app.getState().model.get('busy')).toBe(false)
 resolve({});await pending;expect(app.getState().rows.length).toBe(0)
})

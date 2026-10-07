import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import {HintDialogView} from '@/shared/task-list/list-help';
import { QuickActionsView, QuickActionsApplication } from './application';
import { SessionApplication } from '../../app/session';
import UserModel from '@/models/user';
import ProjectModel from '@/models/project';
import TaskModel from '@/models/task';
import TaskService from '@/services/task';
import TeamService from '@/services/team';
const owners: {
    destroy: () => unknown;
}[] = [];
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); vi.restoreAllMocks(); document.body.replaceChildren(); document.body.style.overflow = ""; });
function mount() { vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; }); vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; }); const session = new SessionApplication(); session.getState().set({ user: new UserModel({ id: 1 }), transition: 1 }); owners.push(session); const navigate = vi.fn(), close = vi.fn(), controller = new QuickActionsApplication({ session, projects: () => [new ProjectModel({ id: 1, title: 'Project' })], labels: () => [], ensureLabels: async () => [], currentProject: () => undefined, commitProject: vi.fn(), navigate }); owners.push(controller); vi.spyOn(controller, 'close').mockImplementation(close); const view = new QuickActionsView({ controller }); const el = document.createElement('div'); document.body.append(el); const region = new Region({ el }); owners.push(region); region.show(view); return { view, navigate, close }; }
it('later search wins when an aborted transport still resolves', async () => { let old!: (tasks: TaskModel[]) => void; const signals: AbortSignal[] = []; vi.spyOn(TaskService.prototype, 'getAll').mockImplementation((_model, params, _page, signal) => { signals.push(signal!); return (params as {
    s?: string;
})?.s === 'old' ? new Promise(resolve => old = resolve) : Promise.resolve([new TaskModel({ id: 2, title: 'new' })]); }); const { view } = mount(); view.input().value = 'old'; view.changed(); const pending = view.search(); view.input().value = 'new'; view.changed(); await view.search(); expect(signals[0].aborted).toBe(true); old([new TaskModel({ id: 1, title: 'old' })]); await pending; expect(view.getState().tasks.map(task => task.title)).toEqual(['new']); });
it('closing the view aborts search and cannot publish a late record', async () => { let resolve!: (tasks: TaskModel[]) => void, signal: AbortSignal | undefined; vi.spyOn(TaskService.prototype, 'getAll').mockImplementation((_model, _params, _page, s) => { signal = s; return new Promise(ready => resolve = ready); }); const { view } = mount(); const pending = view.search(); view.destroy(); expect(signal?.aborted).toBe(true); resolve([new TaskModel({ id: 9, title: 'obsolete' })]); await pending; expect(view.getState().tasks).toHaveLength(0); });
it('failed command retains query and input focus for retry', async () => { vi.spyOn(TaskService.prototype, 'getAll').mockResolvedValue([]); vi.spyOn(TeamService.prototype, 'create').mockRejectedValue(new Error('fixture unavailable')); const { view, close, navigate } = mount(); view.getState().command = 'newTeam'; view.input().value = 'Team draft'; view.changed(); await view.execute(); expect(view.input().value).toBe('Team draft'); expect(view.input()).toBe(document.activeElement); expect(view.getState().error).toContain('fixture unavailable'); expect(close).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled(); });
it('a later creation draft survives an earlier successful command', async () => { vi.spyOn(TaskService.prototype, 'getAll').mockResolvedValue([]); let resolve!: (team: import('@/modelTypes/ITeam').ITeam) => void; vi.spyOn(TeamService.prototype, 'create').mockImplementation(() => new Promise(ready => resolve = ready)); const { view, close, navigate } = mount(); view.getState().command = 'newTeam'; view.input().value = 'Submitted'; view.changed(); const pending = view.execute(); view.input().value = 'Later draft'; view.changed(); resolve({ id: 7, name: 'Submitted' } as import('@/modelTypes/ITeam').ITeam); await pending; expect(view.input().value).toBe('Later draft'); expect(close).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled(); });

it('assignee-prefixed search requests teams even when the task parser retains the prefix', async () => {
 vi.spyOn(TaskService.prototype, 'getAll').mockResolvedValue([]);
 const teams = vi.spyOn(TeamService.prototype, 'getAll').mockResolvedValue([{id: 1, name: 'Search team'}] as never);
 const {view} = mount();
 view.input().value = '@"Search team"'; view.changed(); await view.search();
 expect(teams).toHaveBeenCalledWith(undefined, {s: 'Search team'}, 1, expect.any(AbortSignal));
 expect(view.getState().teams).toEqual([{id: 1, title: 'Search team'}]);
});

it('destroying Quick Actions with open help restores page scrolling and destroys both dialogs', () => {
 vi.spyOn(TaskService.prototype, 'getAll').mockResolvedValue([]);
 document.body.style.overflow = 'auto';
 const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
 const {view} = mount(); view.help();
 const help = view.getChildView('help') as InstanceType<typeof HintDialogView>;
 expect(document.body.style.overflow).toBe('hidden');
 view.destroy();
 expect(help.isDestroyed()).toBe(true);
 expect(document.body.style.overflow).toBe('auto');
 expect(document.activeElement).toBe(trigger);
 expect(document.querySelector('dialog[open]')).toBeNull();
});

it('search metadata respects the user priority threshold and suppresses priority on completed tasks', () => {
 const {view} = mount(), task = new TaskModel({id:1,title:'Colored medium task',priority:2,hexColor:'1973ff'})
 view.getState().tasks = [task]; view.publish()
 expect(view.el.querySelector('.color-bubble')).not.toBeNull(); expect(view.el.querySelector('.priority-label')?.textContent?.trim()).toBe('Medium')
 view.config().session.getState().get('user')!.settings.frontendSettings.minimumPriority = 3; view.publish(); expect(view.el.querySelector('.priority-label')).toBeNull()
 task.priority = 3; view.publish(); expect(view.el.querySelector('.priority-label.high-priority')).not.toBeNull()
 task.done = true; view.publish(); expect(view.el.querySelector('.priority-label')).toBeNull()
})

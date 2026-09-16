import { View } from '../index'
import { html, nothing } from 'lit-html'
import type { ViewInstance } from 'marionette'

interface TaskDetailLabels {
  back: string;
  description: string;
}

interface TaskDetailChildren {
  heading: ViewInstance;
  description: ViewInstance;
  details?: ViewInstance;
  attachments?: ViewInstance;
  comments?: ViewInstance;
  relatedTasks?: ViewInstance;
  actions?: ViewInstance;
}

export interface TaskDetailOptions {
  isModal: boolean;
  labels: TaskDetailLabels;
  onBack: () => void;
  children: TaskDetailChildren;
}

interface TaskDetailContext {
  options: TaskDetailOptions;
  _children: Record<string, ViewInstance>;
  isRendered(): boolean;
  showChildView(name: string, child: ViewInstance): void;
  detachChildView(name: string): void;
}

const TaskDetailLayoutView = View.extend({
	className: 'loader-container task-view-container',
	events: {'click [data-action="back"]': 'onBack'},

	template(data: { isModal: boolean; labels: TaskDetailLabels }) {
		return html`
      <div class="task-view${data.isModal ? ' is-modal' : ''}">
        ${!data.isModal ? html`
          <button type="button" class="back-button mbs-2" data-action="back">${data.labels.back}</button>
        ` : nothing}
        <div class="columns detail-content">
          <div class="column detail-content__main">
            <div class="task-heading-region"></div>
            <h3>${data.labels.description}</h3>
            <div class="task-description-region"></div>
            <div class="task-attachments-region"></div>
            <div class="task-comments-region"></div>
            <div class="task-related-region"></div>
          </div>
          <div class="column detail-content__sidebar">
            <div class="task-details-region"></div>
            <div class="task-actions-region"></div>
          </div>
        </div>
      </div>
    `
	},

	templateContext(this: TaskDetailContext) {
		return {
			isModal: this.options.isModal,
			labels: this.options.labels,
		}
	},

	regions: {
		heading: '.task-heading-region',
		description: '.task-description-region',
		details: '.task-details-region',
		attachments: '.task-attachments-region',
		comments: '.task-comments-region',
		relatedTasks: '.task-related-region',
		actions: '.task-actions-region',
	},

	initialize(this: TaskDetailContext) {
		this._children = {}
		const children = this.options.children
		for (const [name, child] of Object.entries(children)) {
			if (child) {
				this._children[name] = child as ViewInstance
			}
		}
	},

	onBeforeRender(this: TaskDetailContext) {
		if (this.isRendered()) {
			for (const name of Object.keys(this._children)) {
				this.detachChildView(name)
			}
		}
	},

	onRender(this: TaskDetailContext) {
		for (const [name, child] of Object.entries(this._children)) {
			this.showChildView(name, child)
		}
	},

	onBack(this: TaskDetailContext) {
		this.options.onBack()
	},
}) as new (options: TaskDetailOptions) => ViewInstance

export default TaskDetailLayoutView

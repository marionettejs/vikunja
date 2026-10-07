import {t} from '@/shared/i18n'
import type {IProject} from '@/modelTypes/IProject'

export function getProjectTitle(project: Pick<IProject, 'id' | 'title'>) {
	if (project.id === -1) {
		return t('project.pseudo.favorites.title')
	}

	if (project.title === 'Inbox') {
		return t('project.inboxTitle')
	}

	if (project.title === 'My Open Tasks') {
		return t('project.myOpenTasksFilterTitle')
	}

	return project.title
}

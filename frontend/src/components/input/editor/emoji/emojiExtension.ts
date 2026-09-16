import {Extension} from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

import emojiSuggestionSetup from './emojiSuggestion'

type TranslateFunction = (key: string) => string

export function createEmojiExtension(t: TranslateFunction) {
	return Extension.create({
		name: 'emojiAutocomplete',

		addOptions() {
			return {
				suggestion: emojiSuggestionSetup(t),
			}
		},

		addProseMirrorPlugins() {
			return [
				Suggestion({
					editor: this.editor,
					...this.options.suggestion,
				}),
			]
		},
	})
}

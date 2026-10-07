import {isMultiValueOperator} from '@/helpers/filters'

export function calculateReplacementRange(
	context: { startPos: number; endPos: number; keyword: string },
	operator: string,
	hasClosingQuote: boolean = false,
): { replaceFrom: number; replaceTo: number } {
	// Add 1 to convert from string indices to ProseMirror positions
	// In ProseMirror, position 0 is before the document, text starts at position 1
	let replaceFrom = context.startPos + 1
	let replaceTo = context.endPos + 1

	// Handle multi-value operators - only replace the last value after comma
	if (isMultiValueOperator(operator) && context.keyword.includes(',')) {
		const lastCommaIndex = context.keyword.lastIndexOf(',')
		const textAfterComma = context.keyword.substring(lastCommaIndex + 1)
		const leadingSpaces = textAfterComma.length - textAfterComma.trimStart().length
		replaceFrom = context.startPos + lastCommaIndex + 1 + leadingSpaces + 1
	}

	// Extend range to include closing quote if present
	if (hasClosingQuote) {
		replaceTo += 1
	}

	return { replaceFrom, replaceTo }
}

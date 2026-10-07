import {afterEach, expect, it, vi} from 'vitest'
import {getBrowserLanguage} from './i18n'
afterEach(() => vi.restoreAllMocks())
it('reads the browser language once when resolving an unsupported regional locale', () => {
 const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
 expect(getBrowserLanguage()).toBe('en')
 expect(language).toHaveBeenCalledTimes(1)
})
it('observes a later browser language change without retaining a global locale cache', () => {
 const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
 expect(getBrowserLanguage()).toBe('en')
 language.mockReturnValue('de-DE')
 expect(getBrowserLanguage()).toBe('de-DE')
})

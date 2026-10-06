import type {Label} from '@/client/generated'
export function getLabelByExactTitle(labels: Label[], title: string): Label | undefined { return labels.find(label => (label.title ?? '').toLowerCase() === title.toLowerCase()) }

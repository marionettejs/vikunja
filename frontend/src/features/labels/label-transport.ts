import { labelsList, labelsCreate, labelsUpdate, labelsDelete, type Label, type LabelWritable } from '@/client/generated/index'
import { colorFromHex } from '@/helpers/color/colorFromHex'
export async function loadLabels(signal: AbortSignal) { const labels: Label[] = []; let page = 1; while (true) {
	const { data } = await labelsList({ query: { page, per_page: 1000 }, signal })
	labels.push(...(data.items ?? []))
	if (page++ >= (data.total_pages ?? 1))
		break
} signal.throwIfAborted(); return labels }
const body = (label: LabelWritable) => ({ title: label.title, description: label.description ?? '', hex_color: colorFromHex(label.hex_color ?? '') })
export async function createLabel(label: LabelWritable, signal: AbortSignal) { const { data } = await labelsCreate({ body: body(label), signal }); signal.throwIfAborted(); return data }
export async function updateLabel(label: Label, signal: AbortSignal) { const { data } = await labelsUpdate({ path: { id: label.id! }, body: body(label), signal }); signal.throwIfAborted(); return data }
export async function deleteLabel(id: number, signal: AbortSignal) { await labelsDelete({ path: { id }, signal }); signal.throwIfAborted() }

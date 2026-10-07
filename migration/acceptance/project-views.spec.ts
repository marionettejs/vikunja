import { test, expect } from "./fixtures";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { UserFactory } from "../../frontend/tests/factories/user";
import { UserProjectFactory } from "../../frontend/tests/factories/users_project";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
const api = async (page, context) => {
	const token = await page.evaluate(() => localStorage.getItem("token"));
	const response = await context.get("projects/1", {
		headers: { Authorization: `Bearer ${token}` },
	});
	expect(response.ok()).toBeTruthy();
	return response.json();
};
const form = (page) =>
	page
		.locator("form")
		.filter({ has: page.getByRole("textbox", { name: "Title", exact: true }) })
		.last();
const title = (page) =>
	form(page).getByRole("textbox", { name: "Title", exact: true });
const save = (page) =>
	form(page).getByRole("button", { name: "Save", exact: true });
const row = (page, name) =>
	page
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name, exact: true }) });
test.beforeEach(async () => {
	await ProjectFactory.create(1, { id: 1, title: "Configured project" });
	await TaskFactory.create(2, {
		project_id: 1,
		title: (id) => (id === 1 ? "Priority included" : "Excluded task"),
		priority: (id) => (id === 1 ? 3 : 0),
	});
	await createDefaultViews(1);
});
for (const width of [1440, 390])
	test(`project view create edit reload delete confirmation ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/projects/1/settings/views");
		await page
			.getByRole("button", { name: "Create view", exact: true })
			.click();
		await title(page).fill("Focused view");
		await title(page).press("Tab");
		await form(page)
			.getByRole("combobox", { name: "Kind", exact: true })
			.selectOption("table");
		await page
			.getByRole("button", { name: "Create view", exact: true })
			.first()
			.click();
		await expect(row(page, "Focused view")).toBeVisible();
		let p = await api(page, apiContext);
		expect(p.views.find((v) => v.title === "Focused view").view_kind).toBe(
			"table",
		);
		expect(
			p.views.find((v) => v.title === "Focused view").filter.sort_by,
		).toEqual(["done", "id"]);
		expect(
			p.views.find((v) => v.title === "Focused view").filter.order_by,
		).toEqual(["asc", "desc"]);
		await page.reload();
		await row(page, "Focused view")
			.getByRole("button", { name: "Edit this view", exact: true })
			.click();
		await title(page).fill("Renamed view");
		await save(page).click();
		await expect(row(page, "Renamed view")).toBeVisible();
		await page.screenshot({
			path: info.outputPath(`views-${width}.png`),
			animations: "disabled",
		});
		await row(page, "Renamed view")
			.getByRole("button", { name: "Delete this view", exact: true })
			.click();
		await page
			.getByRole("dialog")
			.last()
			.getByRole("button", { name: "Cancel", exact: true })
			.click();
		expect(
			(await api(page, apiContext)).views.some(
				(v) => v.title === "Renamed view",
			),
		).toBeTruthy();
		await row(page, "Renamed view")
			.getByRole("button", { name: "Delete this view", exact: true })
			.click();
		await page
			.getByRole("dialog")
			.last()
			.getByRole("button", { name: "Do it!", exact: true })
			.click();
		await expect(row(page, "Renamed view")).toHaveCount(0);
		expect(
			(await api(page, apiContext)).views.some(
				(v) => v.title === "Renamed view",
			),
		).toBeFalsy();
	});
test("view creation failure retains draft and retries once", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/views");
	await page.getByRole("button", { name: "Create view", exact: true }).click();
	await title(page).fill("Retained view");
	await title(page).press("Tab");
	let failed = false;
	await page.route("**/api/v1/projects/1/views", async (route) => {
		if (route.request().method() === "PUT" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture create unavailable" },
			});
		} else await route.continue();
	});
	await page
		.getByRole("button", { name: "Create view", exact: true })
		.first()
		.click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture create unavailable",
	);
	await expect(title(page)).toHaveValue("Retained view");
	await page
		.getByRole("button", { name: "Create view", exact: true })
		.first()
		.click();
	await expect(row(page, "Retained view")).toBeVisible();
	expect(
		(await api(page, apiContext)).views.filter(
			(v) => v.title === "Retained view",
		),
	).toHaveLength(1);
});
test("delayed view save preserves a later focused draft", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/views");
	await row(page, "list")
		.getByRole("button", { name: "Edit this view", exact: true })
		.click();
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => (ready = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/projects/1/views/1", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response });
	});
	await title(page).fill("Accepted view");
	await save(page).click();
	await begun;
	await title(page).fill("Later focused view");
	await title(page).focus();
	release();
	await expect(save(page)).toBeEnabled();
	await expect(title(page)).toHaveValue("Later focused view");
	await expect(title(page)).toBeFocused();
	expect(
		(await api(page, apiContext)).views.find((v) => v.id === 1).title,
	).toBe("Accepted view");
	await page.unroute("**/api/v1/projects/1/views/1");
	await save(page).click();
	await expect(row(page, "Later focused view")).toBeVisible();
});
test("stopping configuration during accepted mutation cannot publish into next project", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await ProjectFactory.create(1, { id: 2, title: "Next project" }, false);
	await createDefaultViews(2, 5);
	await page.goto("/projects/1/settings/views");
	await row(page, "list")
		.getByRole("button", { name: "Edit this view", exact: true })
		.click();
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => (ready = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/projects/1/views/1", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response });
	});
	await title(page).fill("Old accepted view");
	await save(page).click();
	await begun;
	await page.evaluate(() => {
		history.pushState({}, "", "/projects/2");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	await expect(page.locator("dialog[open]")).toHaveCount(0);
	release();
	await expect(page.locator("body")).not.toContainText("Old accepted view");
	expect(
		(await api(page, apiContext)).views.find((v) => v.id === 1).title,
	).toBe("Old accepted view");
});
test("readonly view configuration has no mutations and actual backend denies writes", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await UserFactory.create(1, { id: 2, username: "view-owner" }, false);
	await ProjectFactory.create(1, {
		id: 1,
		title: "Configured project",
		owner_id: 2,
	});
	await UserProjectFactory.create(1, {
		project_id: 1,
		user_id: 1,
		permission: 0,
	});
	await page.goto("/projects/1/settings/views");
	await expect(
		page.getByRole("button", { name: "Create view", exact: true }),
	).not.toBeVisible();
	await expect(row(page, "list")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Edit this view", exact: true }),
	).toHaveCount(0);
	const token = await page.evaluate(() => localStorage.getItem("token"));
	const response = await apiContext.put("projects/1/views", {
		headers: { Authorization: `Bearer ${token}` },
		data: { title: "Forbidden", view_kind: "list" },
	});
	expect(response.status()).toBe(403);
});
test("filter Kanban view persists query and bucket configuration through reload", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/views");
	await page.getByRole("button", { name: "Create view", exact: true }).click();
	await title(page).fill("Filtered board");
	await title(page).press("Tab");
	await form(page)
		.getByRole("combobox", { name: "Kind", exact: true })
		.selectOption("kanban");
	await form(page).locator("input[value=filter]").check();
	await form(page)
		.getByRole("button", { name: "Create a bucket", exact: true })
		.click();
	const bucket = form(page).locator(".filter-bucket-form");
	await bucket
		.getByRole("textbox", { name: "Title", exact: true })
		.fill("Priority bucket");
	await bucket
		.getByRole("textbox", { name: "Filter query", exact: true })
		.fill("priority >= 3");
	await form(page)
		.getByRole("textbox", { name: "Filter query", exact: true })
		.first()
		.fill("done = false");
	await page
		.getByRole("button", { name: "Create view", exact: true })
		.first()
		.click();
	await expect(row(page, "Filtered board")).toBeVisible();
	const view = (await api(page, apiContext)).views.find(
		(v) => v.title === "Filtered board",
	);
	expect(view.filter.filter).toBe("done = false");
	expect(view.bucket_configuration_mode).toBe("filter");
	expect(view.bucket_configuration[0].filter.filter).toBe("priority >= 3");
	await page.reload();
	await row(page, "Filtered board")
		.getByRole("button", { name: "Edit this view", exact: true })
		.click();
	await expect(
		form(page)
			.getByRole("textbox", { name: "Filter query", exact: true })
			.first(),
	).toContainText("done = false");
	await expect(
		form(page)
			.locator(".filter-bucket-form")
			.getByRole("textbox", { name: "Title", exact: true }),
	).toHaveValue("Priority bucket");
	const includeUnset = form(page).getByRole('checkbox').first();
 await expect(includeUnset).toBeChecked();
 await includeUnset.focus();
 await includeUnset.press('Space');
 await expect(includeUnset).not.toBeChecked();
 await save(page).click();
 await expect(form(page)).toHaveCount(0);
 expect((await api(page,apiContext)).views.find(v=>v.id===view.id).filter.filter_include_nulls).toBe(false);
 await page.goto(`/projects/1/${view.id}`);
	await expect(page.locator(".kanban")).toContainText("Priority bucket");
	await expect(page.locator(".kanban")).toContainText("Priority included");
	await expect(page.locator(".kanban")).not.toContainText("Excluded task");
});
test("rejected view deletion preserves row and confirmation allows retry", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/views");
	let failed = false;
	await page.route("**/api/v1/projects/1/views/1", async (route) => {
		if (route.request().method() === "DELETE" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture delete unavailable" },
			});
		} else await route.continue();
	});
	await row(page, "list")
		.getByRole("button", { name: "Delete this view", exact: true })
		.click();
	const confirm = page.getByRole("dialog").last();
	await confirm.getByRole("button", { name: "Do it!", exact: true }).click();
	await expect(confirm.getByRole("alert")).toContainText(
		"Fixture delete unavailable",
	);
	expect(
		(await api(page, apiContext)).views.some((v) => v.id === 1),
	).toBeTruthy();
	await confirm.getByRole("button", { name: "Do it!", exact: true }).click();
	await expect(row(page, "list")).toHaveCount(0);
	expect(
		(await api(page, apiContext)).views.some((v) => v.id === 1),
	).toBeFalsy();
});

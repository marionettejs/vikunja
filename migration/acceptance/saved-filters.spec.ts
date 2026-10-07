import { test, expect } from "./fixtures";
import { ProjectViewFactory } from "../../frontend/tests/factories/project_view";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { SavedFilterFactory } from "../../frontend/tests/factories/saved_filter";
import { UserFactory } from "../../frontend/tests/factories/user";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
const title = (page) =>
	page.getByRole("textbox", { name: "Title", exact: true });
const query = (page) =>
	page.getByRole("textbox", { name: "Filter query", exact: true });
const save = (page) => page.getByRole("button", { name: "Save", exact: true });
const create = (page) =>
	page.getByRole("button", { name: "Create saved filter", exact: true });
async function created(page) {
	const response = page.waitForResponse(
		(r) =>
			/\/api\/v1\/filters$/.test(r.url()) &&
			r.request().method() === "PUT" &&
			r.ok(),
	);
	await create(page).click();
	const record = await (await response).json();
	return { id: record.id, projectId: -record.id - 1 };
}
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
test("saved filter independent description CRUD and actual query delivery", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.goto("/filters/new");
	await title(page).fill("Description filter");
	const description = page.locator(".modal-content .ProseMirror").first();
	await description.dblclick();
	await expect(description).toHaveAttribute("contenteditable", "true");
	await description.fill("Shared rich description");
	await query(page).fill("priority >= 3");
	await title(page).focus();
	await title(page).press("Tab");
	await page.screenshot({
		path: info.outputPath("independent-filter-dialog.png"),
		animations: "disabled",
	});
	const current = await created(page);
	await expect(page).toHaveURL(
		new RegExp(`/projects/${current.projectId}(?:/\\d+)?`),
	);
	await expect(page.locator(".tasks")).toContainText("High priority task");
	await expect(page.locator(".tasks")).not.toContainText("Low priority task");
	expect((await filter(page, apiContext, current.id)).description).toContain(
		"Shared rich description",
	);
	await page.goto(`/projects/${current.projectId}/settings/edit`);
	await expect(description).toContainText("Shared rich description");
	await title(page).fill("Description filter saved");
	await query(page).fill("priority = 1");
	await title(page).press("Tab");
	await save(page).click();
	await expect(title(page)).not.toBeVisible();
	expect((await filter(page, apiContext, current.id)).title).toBe(
		"Description filter saved",
	);
	await page.goto(`/projects/${current.projectId}`);
	await expect(page.locator(".tasks")).toContainText("Low priority task");
	await expect(page.locator(".tasks")).not.toContainText("High priority task");
	await page.reload();
	await expect(page.locator(".tasks")).toContainText("Low priority task");
	await page.screenshot({
		path: info.outputPath("independent-filter-result.png"),
		animations: "disabled",
	});
	await page.goto(`/projects/${current.projectId}/settings/delete`);
	await page
		.getByRole("button", { name: "Do it!", exact: true })
		.last()
		.click();
	await expect(page).toHaveURL(/\/projects$/);
	expect(
		(
			await apiContext.get(`filters/${current.id}`, {
				headers: await auth(page),
			})
		).ok(),
	).toBeFalsy();
	await expect(page.locator(".project-grid")).not.toContainText(
		"Description filter saved",
	);
});
async function filter(page, context, id = 1) {
	const response = await context.get(`filters/${id}`, {
		headers: await auth(page),
	});
	expect(response.ok()).toBeTruthy();
	return response.json();
}
test.beforeEach(async ({ authenticatedPage: page }) => {
	void page;
	await ProjectFactory.create(1, { title: "Source project" });
	await createDefaultViews(1);
	await TaskFactory.create(2, {
		project_id: 1,
		title: (id) => (id === 1 ? "High priority task" : "Low priority task"),
		priority: (id) => (id === 1 ? 3 : 1),
	});
	await SavedFilterFactory.create(0);
});
for (const width of [1440, 390])
	test(`saved filter create actual tasks reload edit and cancel delete ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/filters/new");
		await expect(title(page)).toBeFocused();
		await title(page).fill("Priority filter");
		const description = page.locator(".modal-content .ProseMirror").first();
		await description.dblclick();
		await expect(description).toHaveAttribute("contenteditable", "true");
		await description.fill("Saved filter description");
		await query(page).fill("priority >= 3");
		await page.screenshot({
			path: info.outputPath(`saved-filter-dialog-${width}.png`),
			animations: "disabled",
		});
		const current = await created(page);
		await expect(page).toHaveURL(
			new RegExp(`/projects/${current.projectId}(?:/\\d+)?(?:\\?.*)?$`),
		);
		await expect(page.locator(".tasks")).toContainText("High priority task");
		await expect(page.locator(".tasks")).not.toContainText("Low priority task");
		let record = await filter(page, apiContext, current.id);
		expect(record.description).toContain("Saved filter description");
		expect(record.filters.filter).toBe("priority >= 3");
		expect(record.filters.sort_by).toEqual(["done", "id"]);
		await page.reload();
		await expect(page.locator(".tasks")).toContainText("High priority task");
		await page.goto(`/projects/${current.projectId}/settings/edit`);
		await expect(title(page)).toHaveValue("Priority filter");
		await expect(
			page.locator(".modal-content .ProseMirror").first(),
		).toContainText("Saved filter description");
		await title(page).fill("Renamed filter");
		await query(page).fill("priority = 1");
		await save(page).click();
		await expect(title(page)).not.toBeVisible();
		record = await filter(page, apiContext, current.id);
		expect(record.title).toBe("Renamed filter");
		expect(record.filters.filter).toBe("priority = 1");
		await page.goto(`/projects/${current.projectId}`);
		await expect(page.locator(".tasks")).toContainText("Low priority task");
		await expect(page.locator(".tasks")).not.toContainText(
			"High priority task",
		);
		await page.screenshot({
			path: info.outputPath(`saved-filter-${width}.png`),
			animations: "disabled",
		});
		await page.goto(`/projects/${current.projectId}/settings/delete`);
		await page
			.getByRole("button", { name: "Cancel", exact: true })
			.last()
			.click();
		expect((await filter(page, apiContext, current.id)).title).toBe(
			"Renamed filter",
		);
		await page.goto(`/projects/${current.projectId}/settings/delete`);
		await page
			.getByRole("button", { name: "Do it!", exact: true })
			.last()
			.click();
		await expect(page).toHaveURL(/\/projects$/);
		const deleted = await apiContext.get(`filters/${current.id}`, {
			headers: await auth(page),
		});
		expect(deleted.ok()).toBeFalsy();
		await expect(page.locator(".project-grid")).not.toContainText(
			"Renamed filter",
		);
	});
test("saved filter validation query errors creation retry and simple search persist", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/filters/new");
	await create(page).click();
	await expect(page.getByRole("alert")).toContainText("Please provide a title");
	await title(page).fill("Retained search");
	await query(page).fill("High priority");
	let failed = false;
	await page.route("**/api/v1/filters", async (route) => {
		if (route.request().method() === "PUT" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture filter unavailable" },
			});
		} else await route.continue();
	});
	await create(page).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture filter unavailable",
	);
	await expect(title(page)).toHaveValue("Retained search");
	await expect(query(page)).toContainText("High priority");
	const current = await created(page);
	await expect(page).toHaveURL(
		new RegExp(`/projects/${current.projectId}(?:/\\d+)?`),
	);
	const record = await filter(page, apiContext, current.id);
	expect(record.filters.s).toBe("High priority");
	expect(record.filters.filter).toBe("");
	await expect(page.locator(".tasks")).toContainText("High priority task");
	await expect(page.locator(".tasks")).not.toContainText("Low priority task");
});
test("accepted saved filter edit retains later focused draft and retry cannot duplicate", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await SavedFilterFactory.create(1, {
		filters: JSON.stringify({
			sort_by: ["done", "id"],
			order_by: ["asc", "desc"],
			filter: "done = false",
			filter_include_nulls: false,
			s: "",
		}),
		title: "Draft filter",
	});
	await page.goto("/projects/-2/settings/edit");
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => (ready = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/filters/1", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response });
	});
	await title(page).fill("Accepted filter");
	await save(page).click();
	await begun;
	await title(page).fill("Later focused filter");
	await title(page).focus();
	release();
	await expect(save(page)).toBeEnabled();
	await expect(title(page)).toHaveValue("Later focused filter");
	await expect(title(page)).toBeFocused();
	expect((await filter(page, apiContext)).title).toBe("Accepted filter");
	await page.unroute("**/api/v1/filters/1");
	await save(page).click();
	expect((await filter(page, apiContext)).title).toBe("Later focused filter");
	await expect(title(page)).not.toBeVisible();
});
test("saved filter save and delete rejection retain draft and allow retry", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await SavedFilterFactory.create(1, {
		filters: JSON.stringify({
			sort_by: ["done", "id"],
			order_by: ["asc", "desc"],
			filter: "done = false",
			filter_include_nulls: false,
			s: "",
		}),
		title: "Retry filter",
	});
	await page.goto("/projects/-2/settings/edit");
	let failed = false;
	await page.route("**/api/v1/filters/1", async (route) => {
		if (route.request().method() === "POST" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture save unavailable" },
			});
		} else await route.continue();
	});
	await title(page).fill("Retry saved");
	await save(page).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture save unavailable",
	);
	await expect(title(page)).toHaveValue("Retry saved");
	await save(page).click();
	await expect(title(page)).not.toBeVisible();
	expect((await filter(page, apiContext)).title).toBe("Retry saved");
	await page.unroute("**/api/v1/filters/1");
	failed = false;
	await page.route("**/api/v1/filters/1", async (route) => {
		if (route.request().method() === "DELETE" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture delete unavailable" },
			});
		} else await route.continue();
	});
	await page.goto("/projects/-2/settings/delete");
	await page
		.getByRole("button", { name: "Do it!", exact: true })
		.last()
		.click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture delete unavailable",
	);
	expect((await filter(page, apiContext)).title).toBe("Retry saved");
	await page
		.getByRole("button", { name: "Do it!", exact: true })
		.last()
		.click();
	await expect(page).toHaveURL(/\/projects$/);
});
test("navigation during accepted saved filter write cannot replace the next creation draft", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await SavedFilterFactory.create(1, {
		filters: JSON.stringify({
			sort_by: ["done", "id"],
			order_by: ["asc", "desc"],
			filter: "done = false",
			filter_include_nulls: false,
			s: "",
		}),
		title: "Old filter",
	});
	await page.goto("/projects/-2/settings/edit");
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => (ready = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/filters/1", async (route) => {
		if (route.request().method() !== "POST") {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response });
	});
	await title(page).fill("Old accepted filter");
	await save(page).click();
	await begun;
	await page.evaluate(() => {
		history.pushState({}, "", "/filters/new");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	await title(page).fill("Next creation draft");
	release();
	await expect(title(page)).toHaveValue("Next creation draft");
	await expect(page).toHaveURL(/\/filters\/new$/);
	expect((await filter(page, apiContext)).title).toBe("Old accepted filter");
	await expect(page.locator("body")).not.toContainText(
		"The filter was saved successfully",
	);
});
test("saved filter ownership denies another user reading or mutating through API and routes", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await UserFactory.create(1, { id: 2, username: "filter-owner" }, false);
	await SavedFilterFactory.create(1, {
		filters: JSON.stringify({
			sort_by: ["done", "id"],
			order_by: ["asc", "desc"],
			filter: "done = false",
			filter_include_nulls: false,
			s: "",
		}),
		owner_id: 2,
		title: "Private filter",
	});
	await page.goto("/projects");
	const headers = await auth(page);
	for (const method of ["get", "post", "delete"]) {
		const response = await apiContext[method]("filters/1", {
			headers,
			...(method === "post"
				? {
						data: {
							title: "Forbidden",
							filters: {
								sort_by: ["done", "id"],
								order_by: ["asc", "desc"],
								filter: "done = false",
								filter_include_nulls: false,
								s: "",
							},
						},
					}
				: {}),
		});
		expect([403, 404]).toContain(response.status());
	}
	await page.goto("/projects/-2/settings/edit");
	await expect(page.locator("body")).toContainText(
		/not exist|access|permission|Forbidden/i,
	);
	await expect(save(page)).toHaveCount(0);
	await page.goto("/projects/-2/settings/delete");
	await expect(page.locator("body")).toContainText(
		/not exist|access|permission|Forbidden/i,
	);
	await expect(
		page.getByRole("button", { name: "Do it!", exact: true }),
	).toHaveCount(0);
});
test("accepted saved filter creation retries refresh without creating again and opens its menu", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/filters/new");
	await title(page).fill("One accepted filter");
	const acceptedDescription = page
		.locator(".modal-content .ProseMirror")
		.first();
	await acceptedDescription.dblclick();
	await acceptedDescription.fill("Accepted description draft");
	await query(page).fill("priority >= 3");
	let writes = 0,
		acceptedId = 0,
		refreshFailed = false;
	await page.route("**/api/v1/filters", async (route) => {
		if (route.request().method() !== "PUT") {
			await route.continue();
			return;
		}
		writes++;
		const response = await route.fetch();
		acceptedId = (await response.json()).id;
		await route.fulfill({ response });
	});
	await page.route("**/api/v1/projects/-*", async (route) => {
		if (acceptedId && !refreshFailed) {
			refreshFailed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture filter refresh unavailable" },
			});
		} else await route.continue();
	});
	await create(page).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture filter refresh unavailable",
	);
	await expect(title(page)).toHaveValue("One accepted filter");
	await create(page).click();
	await expect(page).toHaveURL(
		new RegExp(`/projects/${-acceptedId - 1}(?:/\\d+)?$`),
	);
	expect(writes).toBe(1);
	expect((await filter(page, apiContext, acceptedId)).title).toBe(
		"One accepted filter",
	);
	const menu = page.getByRole("banner", {name: "main navigation"}).getByRole("button", { name: "Open project settings menu" });
	await menu.focus();
	await menu.press("Enter");
	await expect(
		page.getByRole("link", { name: "Edit", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Duplicate", exact: true }),
	).toHaveCount(0);
	await page.getByRole("link", { name: "Edit", exact: true }).click();
	await expect(title(page)).toHaveValue("One accepted filter");
	await page.keyboard.press("Escape");
	await expect(page.locator("dialog")).not.toBeVisible();
	await expect(menu).toBeFocused();
	await page.goto("/filters/new");
	await expect(
		page.locator(".modal-content .ProseMirror").first(),
	).not.toContainText("Accepted description draft");
});
test("saved filter view configuration accepts negative project owner and persists native kind", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/filters/new");
	await title(page).fill("Configured saved filter");
	const current = await created(page);
	await expect(page).toHaveURL(
		new RegExp(`/projects/${current.projectId}(?:/\\d+)?`),
	);
	await page.goto(`/projects/${current.projectId}/settings/views`);
	await page.getByRole("button", { name: "Create view", exact: true }).click();
	await title(page).fill("Saved filter table");
	await title(page).press("Tab");
	await page
		.getByRole("combobox", { name: "Kind", exact: true })
		.selectOption("table");
	await page
		.getByRole("button", { name: "Create view", exact: true })
		.first()
		.click();
	await expect(
		page.getByRole("cell", { name: "Saved filter table", exact: true }),
	).toBeVisible();
	const response = await apiContext.get(`projects/${current.projectId}`, {
		headers: await auth(page),
	});
	expect(response.ok()).toBeTruthy();
	expect(
		(await response.json()).views.some(
			(v) => v.title === "Saved filter table" && v.view_kind === "table",
		),
	).toBeTruthy();
});
test("view ordering persists through reload and rejects without losing rows", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await ProjectViewFactory.create(4, {
		project_id: 1,
		title: (id) => ["List", "Gantt", "Table", "Kanban"][id - 1],
		view_kind: (id) => id - 1,
		position: (id) => id * 65536,
		bucket_configuration_mode: (id) => (id === 4 ? 1 : 0),
	});
	await page.goto("/projects/1/settings/views");
	const row = (kind) =>
		page
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: kind, exact: true }) });
	await row("kanban").locator(".handle").dragTo(row("list").locator(".handle"));
	const response = await apiContext.get("projects/1", {
		headers: await auth(page),
	});
	expect(response.ok()).toBeTruthy();
	const reordered = (await response.json()).views;
	expect(
		[...reordered].sort((a, b) => a.position - b.position)[0].view_kind,
	).toBe("kanban");
	await page.reload();
	await expect(page.locator("tbody tr").first()).toContainText("kanban");
	let failed = false;
	await page.route("**/api/v1/projects/1/views/3", async (route) => {
		if (route.request().method() === "POST" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture ordering unavailable" },
			});
		} else await route.continue();
	});
	await row("table")
		.locator(".handle")
		.dragTo(row("kanban").locator(".handle"));
	await expect(page.getByRole("alert")).toContainText(
		"Fixture ordering unavailable",
	);
	await expect(page.locator("tbody tr").first()).toContainText("kanban");
	await expect(page.locator("tbody tr")).toHaveCount(4);
	await page.unroute("**/api/v1/projects/1/views/3");
	await row("table")
		.locator(".handle")
		.dragTo(row("kanban").locator(".handle"));
	await expect(page.locator("tbody tr").first()).toContainText("table");
});

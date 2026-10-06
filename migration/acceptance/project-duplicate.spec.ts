import { test, expect } from "./fixtures";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { UserFactory } from "../../frontend/tests/factories/user";
import { UserProjectFactory } from "../../frontend/tests/factories/users_project";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
const duplicate = (page) =>
	page.getByRole("button", { name: "Duplicate", exact: true }).last();
const shares = (page) => page.getByRole("checkbox", { name: /Copy shares/ });
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
test.beforeEach(async ({ authenticatedPage: page }) => {
	void page;
	await UserFactory.create(1, { id: 2, username: "copy-member" }, false);
	await ProjectFactory.create(2, {
		title: (id) => (id === 1 ? "Source to copy" : "Parent destination"),
		parent_project_id: (id) => (id === 1 ? 2 : 0),
		description: "Description to copy",
		hex_color: "123456",
	});
	await createDefaultViews(1);
	await TaskFactory.create(2, {
		project_id: 1,
		title: (id) => `Copy task ${id}`,
		done: (id) => id === 2,
	});
	await UserProjectFactory.create(1, {
		user_id: 2,
		project_id: 1,
		permission: 1,
	});
});
for (const copyShares of [true, false])
	test(`duplicate real project tasks views metadata and shares ${copyShares}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.goto("/projects/1/settings/duplicate");
		await expect(shares(page)).toBeChecked();
		if (!copyShares) {
			await shares(page).focus();
			await page.keyboard.press("Space");
			await expect(shares(page)).not.toBeChecked();
		}
		await page.screenshot({
			path: info.outputPath(`duplicate-${copyShares}.png`),
			animations: "disabled",
		});
		const accepted = page.waitForResponse(
			(r) =>
				r.url().endsWith("/api/v1/projects/1/duplicate") &&
				r.request().method() === "PUT" &&
				r.ok(),
		);
		await duplicate(page).click();
		const result = await (await accepted).json(),
			id = result.duplicated_project.id;
		await expect(page).toHaveURL(new RegExp(`/projects/${id}(?:/\\d+)?$`));
		const headers = await auth(page),
			record = await apiContext.get(`projects/${id}`, { headers });
		expect(record.ok()).toBeTruthy();
		const model = await record.json();
		expect(model.title).toBe("Source to copy - duplicate");
		expect(model.parent_project_id).toBe(2);
		expect(model.description).toBe("Description to copy");
		expect(model.hex_color).toBe("123456");
		expect(model.views.map((v) => v.view_kind).sort()).toEqual([
			"gantt",
			"kanban",
			"list",
			"table",
		]);
		const tasks = await apiContext.get(`projects/${id}/tasks`, { headers });
		expect(tasks.ok()).toBeTruthy();
		expect(
			(await tasks.json()).map((task) => [task.title, task.done]).sort(),
		).toEqual([
			["Copy task 1", false],
			["Copy task 2", true],
		]);
		const members = await apiContext.get(`projects/${id}/users`, { headers });
		expect(members.ok()).toBeTruthy();
		expect((await members.json()).some((member) => member.id === 2)).toBe(
			copyShares,
		);
		await page.goto(
			`/projects/${id}/${model.views.find((view) => view.view_kind === "list").id}`,
		);
		await page.reload();
		await expect(page.locator(".tasks")).toContainText("Copy task 1");
	});
test("duplicate rejection retry and accepted refresh failure create only one copy", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/duplicate");
	let writes = 0,
		accepted = false,
		refreshFailed = false;
	await page.route("**/api/v1/projects/1/duplicate", async (route) => {
		writes++;
		if (writes === 1) {
			await route.fulfill({
				status: 503,
				json: { message: "Fixture duplication unavailable" },
			});
			return;
		}
		const response = await route.fetch();
		accepted = response.ok();
		await route.fulfill({ response });
	});
	await page.route("**/api/v1/projects?*", async (route) => {
		if (accepted && !refreshFailed) {
			refreshFailed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture copy refresh unavailable" },
			});
		} else await route.continue();
	});
	await duplicate(page).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture duplication unavailable",
	);
	await expect(shares(page)).toBeChecked();
	await duplicate(page).click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture copy refresh unavailable",
	);
	await duplicate(page).click();
	await expect(page).toHaveURL(/\/projects\/\d+(?:\/\d+)?$/);
	expect(writes).toBe(2);
	const projects = await apiContext.get("projects", {
		headers: await auth(page),
	});
	expect(
		(await projects.json()).filter(
			(p) => p.title === "Source to copy - duplicate",
		),
	).toHaveLength(1);
});
test("duplicate cancellation discards stale success and real API denies foreign destination", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await ProjectFactory.create(
		1,
		{ id: 3, title: "Foreign destination", owner_id: 2 },
		false,
	);
	await page.goto("/projects/1/settings/duplicate");
	const forbidden = await apiContext.put("projects/1/duplicate", {
		headers: await auth(page),
		data: { parent_project_id: 3, duplicate_shares: true },
	});
	expect([403, 404]).toContain(forbidden.status());
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => {
			ready = r;
		}),
		gate = new Promise<void>((r) => {
			release = r;
		});
	await page.route("**/api/v1/projects/1/duplicate", async (route) => {
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await duplicate(page).click();
	await begun;
	await page.keyboard.press("Escape");
	await expect(page.locator("dialog")).not.toBeVisible();
	await page.goto("/filters/new");
	await page
		.getByRole("textbox", { name: "Title", exact: true })
		.fill("Next draft");
	release();
	await expect(
		page.getByRole("textbox", { name: "Title", exact: true }),
	).toHaveValue("Next draft");
	await expect(page).toHaveURL(/\/filters\/new$/);
	await expect(page.locator("body")).not.toContainText(
		"The project was successfully duplicated.",
	);
	const projects = await apiContext.get("projects", {
		headers: await auth(page),
	});
	expect(
		(await projects.json()).filter(
			(p) => p.title === "Source to copy - duplicate",
		),
	).toHaveLength(1);
});

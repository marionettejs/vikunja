import { test, expect } from "./fixtures";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { UserFactory } from "../../frontend/tests/factories/user";
import { UserProjectFactory } from "../../frontend/tests/factories/users_project";
import { LabelFactory } from "../../frontend/tests/factories/labels";
import { LabelTaskFactory } from "../../frontend/tests/factories/label_task";
import { SavedFilterFactory } from "../../frontend/tests/factories/saved_filter";
import { LinkShareFactory } from "../../frontend/tests/factories/link_sharing";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
const image = resolve(
	import.meta.dirname,
	"../../frontend/tests/fixtures/image.jpg",
);
const blueImage = resolve(
	import.meta.dirname,
	"../../frontend/tests/fixtures/image-blue.png",
);
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
async function project(page, apiContext, id = 1) {
	const response = await apiContext.get(`projects/${id}`, {
		headers: await auth(page),
	});
	expect(response.ok()).toBeTruthy();
	return response.json();
}
async function upload(page, file = image) {
	const accepted = page.waitForResponse(
		(r) =>
			r.url().endsWith("/backgrounds/upload") &&
			r.request().method() === "PUT" &&
			r.ok(),
	);
	await page.locator("input[type=file]").setInputFiles(file);
	await accepted;
	await expect(
		page.getByRole("button", { name: "Remove Background", exact: true }),
	).toBeVisible();
}
const background = (page) => page.locator(".app-container-background");
const rangeURL =
	"/tasks/by/upcoming?from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z";
test.beforeEach(async ({ authenticatedPage: page }) => {
	void page;
	await ProjectFactory.create(2, {
		title: (id) => `Surface project ${id}`,
		description: (id) =>
			id === 1
				? '<p>Project description <strong>content</strong></p><a href="https://example.test" target="_blank">Reference</a><script>window.descriptionAttack=true</script>'
				: "",
	});
	await createDefaultViews(1);
	await createDefaultViews(2, 5);
	await TaskFactory.create(5, {
		project_id: 1,
		title: (id) =>
			["In range", "Overdue", "Undated", "After range", "Completed range"][
				id - 1
			],
		due_date: (id) =>
			[
				"2026-10-07T12:00:00Z",
				"2026-10-01T12:00:00Z",
				null,
				"2026-11-01T12:00:00Z",
				"2026-10-07T12:00:00Z",
			][id - 1],
		done: (id) => id === 5,
	});
});
for (const width of [1440, 390])
	test(`background real upload shell reload remove and information ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/projects/1/1");
		await page
			.getByRole("banner")
			.getByRole("button", { name: "Open project settings menu" })
			.click();
		await page
			.getByRole("link", { name: "Background settings", exact: true })
			.click();
		await upload(page);
		const saved = await project(page, apiContext);
		expect(saved.background_information).toBeTruthy();
		expect(saved.background_blur_hash).toBeTruthy();
		await expect(background(page)).toHaveClass(/is-visible/);
		await expect(page.locator(".app-container")).toHaveClass(/has-background/);
		await page
			.getByRole("button", { name: "Close", exact: true })
			.last()
			.click();
		await page.screenshot({
			path: info.outputPath(`background-${width}.png`),
			animations: "disabled",
		});
		await page.reload();
		await expect(background(page)).toHaveClass(/is-visible/);
		await page
			.getByRole("link", { name: "Project description", exact: true })
			.click();
		await expect(page.locator(".modal-content")).toContainText(
			"Project description content",
		);
		const link = page
			.locator(".modal-content")
			.getByRole("link", { name: "Reference" });
		await expect(link).toHaveAttribute("rel", "noopener noreferrer");
		expect(
			await page.evaluate(() => Boolean((window as any).descriptionAttack)),
		).toBeFalsy();
		await page.keyboard.press("Escape");
		await expect(page.locator("dialog")).not.toBeVisible();
		await page.goto("/projects/1/settings/background");
		await page
			.getByRole("button", { name: "Remove Background", exact: true })
			.click();
		await expect(page.locator("dialog")).not.toBeVisible();
		expect(
			(await project(page, apiContext)).background_information,
		).toBeFalsy();
		await page.goto("/projects/1/1");
		await expect(page.locator(".app-container")).not.toHaveClass(
			/has-background/,
		);
	});
test("background invalid image and upload removal rejection retain controls and retry", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/background");
	await page.locator("input[type=file]").setInputFiles({
		name: "invalid.jpg",
		mimeType: "image/jpeg",
		buffer: Buffer.from("Not an image"),
	});
	await expect(
		page.locator(".modal-content [data-error][role=alert]"),
	).toContainText(/image|format|invalid/i);
	expect((await project(page, apiContext)).background_information).toBeFalsy();
	let failed = false;
	await page.route("**/api/v1/projects/1/backgrounds/upload", async (route) => {
		if (!failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture upload unavailable" },
			});
		} else await route.continue();
	});
	await page.locator("input[type=file]").setInputFiles(image);
	await expect(
		page.locator(".modal-content [data-error][role=alert]"),
	).toContainText("Fixture upload unavailable");
	await upload(page, blueImage);
	const accepted = await project(page, apiContext);
	failed = false;
	await page.route("**/api/v1/projects/1/background", async (route) => {
		if (route.request().method() === "DELETE" && !failed) {
			failed = true;
			await route.fulfill({
				status: 503,
				json: { message: "Fixture removal unavailable" },
			});
		} else await route.continue();
	});
	await page
		.getByRole("button", { name: "Remove Background", exact: true })
		.click();
	await expect(
		page.locator(".modal-content [data-error][role=alert]"),
	).toContainText("Fixture removal unavailable");
	expect((await project(page, apiContext)).background_information).toEqual(
		accepted.background_information,
	);
	await page
		.getByRole("button", { name: "Remove Background", exact: true })
		.click();
	await expect(page.locator("dialog")).not.toBeVisible();
	expect((await project(page, apiContext)).background_information).toBeFalsy();
});
test("accepted background upload cannot publish into next project dialog", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/background");
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => {
			ready = r;
		}),
		gate = new Promise<void>((r) => {
			release = r;
		});
	await page.route("**/api/v1/projects/1/backgrounds/upload", async (route) => {
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page.locator("input[type=file]").setInputFiles(image);
	await begun;
	await page.keyboard.press("Escape");
	await page.goto("/projects/2/settings/background");
	release();
	await expect(
		page.getByRole("button", { name: "Remove Background", exact: true }),
	).not.toBeVisible();
	expect(
		(await project(page, apiContext, 1)).background_information,
	).toBeTruthy();
	expect(
		(await project(page, apiContext, 2)).background_information,
	).toBeFalsy();
	await expect(page.locator("body")).not.toContainText(
		"The background has been set successfully!",
	);
});
test("late shell background read is canceled on navigation and brightness persists", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/projects/1/settings/background");
	await upload(page);
	await page.keyboard.press("Escape");
	await page.goto("/user/settings/general");
	const slider = page.getByRole("spinbutton", {
		name: /background.*brightness/i,
	});
	await slider.fill("40");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await page.goto("/projects/1/1");
	await expect(background(page)).toHaveClass(/is-visible/);
	await expect(background(page)).toHaveCSS("filter", "brightness(0.4)");
	await page.reload();
	await expect(background(page)).toHaveCSS("filter", "brightness(0.4)");
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => {
			ready = r;
		}),
		gate = new Promise<void>((r) => {
			release = r;
		});
	await page.route("**/api/v1/projects/1/background", async (route) => {
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page.goto("/projects/1/1");
	await begun;
	await page.evaluate(() => {
		history.pushState({}, "", "/projects/2");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	release();
	await expect(page).toHaveURL(/\/projects\/2(?:\/\d+)?$/);
	await expect(page.locator(".app-container")).not.toHaveClass(
		/has-background/,
	);
	await expect(background(page)).not.toHaveClass(/is-visible/);
	expect(
		(await project(page, apiContext, 1)).background_information,
	).toBeTruthy();
});
test("readonly background controls absent and backend rejects upload delete", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await UserFactory.create(1, { id: 3, username: "background-owner" }, false);
	await ProjectFactory.create(
		1,
		{ id: 3, owner_id: 3, title: "Readonly background" },
		false,
	);
	await UserProjectFactory.create(1, {
		project_id: 3,
		user_id: 1,
		permission: 0,
	});
	await page.goto("/projects/3/settings/background");
	await expect(
		page.getByRole("button", {
			name: "Choose a background from your pc",
			exact: true,
		}),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Remove Background", exact: true }),
	).not.toBeVisible();
	const headers = await auth(page),
		uploadResult = await apiContext.put("projects/3/backgrounds/upload", {
			headers,
			multipart: {
				background: {
					name: "image.jpg",
					mimeType: "image/jpeg",
					buffer: await readFile(image),
				},
			},
		});
	expect([403, 404]).toContain(uploadResult.status());
	const removed = await apiContext.delete("projects/3/background", { headers });
	expect([403, 404]).toContain(removed.status());
});
for (const width of [1440, 390])
	test(`upcoming range overdue dateless reload task completion ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(rangeURL);
		const rows = page.locator(".tasks");
		await expect(rows).toContainText("In range");
		await expect(rows).not.toContainText("Overdue");
		await expect(rows).not.toContainText("Undated");
		await expect(rows).not.toContainText("After range");
		await expect(rows).not.toContainText("Completed range");
		const overdue = page.getByRole("checkbox", {
			name: "Show overdue tasks",
			exact: true,
		});
		await overdue.focus();
		await page.keyboard.press("Space");
		await expect(page).toHaveURL(/showOverdue=true/);
		await expect(rows).toContainText("Overdue");
		const dateless = page.getByRole("checkbox", {
			name: "Show tasks without date",
			exact: true,
		});
		await dateless.focus();
		await page.keyboard.press("Space");
		await expect(rows).toContainText("Undated");
		await page.reload();
		await expect(dateless).toBeChecked();
		await expect(overdue).toBeChecked();
		await page.screenshot({
			path: info.outputPath(`upcoming-${width}.png`),
			animations: "disabled",
		});
		const row = page
			.locator(".single-task")
			.filter({ hasText: "In range" })
			.first();
		await row.getByRole("checkbox").focus();
		await page.keyboard.press("Space");
		await expect(row.getByRole("checkbox")).toBeChecked();
		const task = await apiContext.get("tasks/1", { headers: await auth(page) });
		expect((await task.json()).done).toBeTruthy();
		await page.reload();
		await expect(rows).not.toContainText("In range");
	});
test("upcoming preset custom range loading error retry and route teardown", async ({
	authenticatedPage: page,
}, info) => {
	await page.goto(rangeURL);
	await page
		.getByRole("button", { name: "Select a date range", exact: true })
		.click();
	await page.getByRole("button", { name: "Next 7 Days", exact: true }).click();
	await expect(page).toHaveURL(/from=now/);
	await page.screenshot({
		path: info.outputPath("upcoming-range.png"),
		animations: "disabled",
	});
	await page
		.getByRole("textbox", { name: "From", exact: true })
		.fill("2026-10-31");
	await page.getByRole("textbox", { name: "From", exact: true }).press("Tab");
	await page
		.getByRole("textbox", { name: "To", exact: true })
		.fill("2026-11-03");
	await page.getByRole("textbox", { name: "To", exact: true }).press("Tab");
	await expect(page.locator(".tasks")).toContainText("After range");
	await page.keyboard.press("Escape");
	await expect(
		page.getByRole("textbox", { name: "From", exact: true }),
	).not.toBeVisible();
	await expect(
		page.getByRole("button", { name: "Select a date range", exact: true }),
	).toBeFocused();
	await page.route("**/api/v1/tasks?*", (route) =>
		route.fulfill({
			status: 503,
			json: { message: "Fixture upcoming unavailable" },
		}),
	);
	await page.goto(rangeURL);
	await expect(
		page.locator(".native-daily-entry [data-error][role=alert]"),
	).toContainText("Fixture upcoming unavailable");
	await page.unroute("**/api/v1/tasks?*");
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.locator(".tasks")).toContainText("In range");
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => {
			ready = r;
		}),
		gate = new Promise<void>((r) => {
			release = r;
		});
	await page.route("**/api/v1/tasks?*", async (route) => {
		const response = await route.fetch();
		ready();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page
		.getByRole("checkbox", { name: "Show overdue tasks", exact: true })
		.focus();
	await page.keyboard.press("Space");
	await begun;
	await page.evaluate(() => {
		history.pushState({}, "", "/projects/2");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	release();
	await expect(page).toHaveURL(/\/projects\/2(?:\/\d+)?$/);
	await expect(page.locator("body")).not.toContainText(
		"Fixture upcoming unavailable",
	);
});
test("home labels show ignored saved filter notice clear and return real tasks", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await LabelFactory.create(1, { title: "Review label" });
	await LabelTaskFactory.create(1, { task_id: 1, label_id: 1 });
	await SavedFilterFactory.create(1, {
		title: "Saved home filter",
		filters: JSON.stringify({
			sort_by: ["done", "id"],
			order_by: ["asc", "desc"],
			filter: "priority >= 5",
			filter_include_nulls: false,
			s: "",
		}),
	});
	await page.goto("/");
	const headers = await auth(page),
		settings = await apiContext.get("user", { headers });
	expect(settings.ok()).toBeTruthy();
	const value = (await settings.json()).settings;
	const savedSettings = await apiContext.post("user/settings/general", {
		headers,
		data: {
			...value,
			frontend_settings: {
				...value.frontend_settings,
				filter_id_used_on_overview: -2,
			},
		},
	});
	expect(savedSettings.ok()).toBeTruthy();
	await page.goto("/?labels=1");
	await expect(page.locator(".label-filter-info")).toContainText(
		"Review label",
	);
	await expect(page.locator("body")).toContainText(
		"Your saved homepage filter is not applied",
	);
	await expect(page.locator(".tasks")).toContainText("In range");
	await expect(page.locator(".tasks")).not.toContainText("Overdue");
	await page
		.getByRole("button", { name: "Clear label filter", exact: true })
		.click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator(".label-filter-info")).toHaveCount(0);
	await expect(page.locator(".tasks")).not.toContainText("In range");
});
test("background provider local contract search paging cancellation and selection error", async ({
	authenticatedPage: page,
}) => {
	const bytes = await readFile(image);
	await page.route("**/api/v1/info", async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			json: {
				...(await response.json()),
				enabled_background_providers: ["upload", "unsplash"],
			},
		});
	});
	const photo = (id: string, authorName: string) => ({
		id,
		blur_hash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
		info: { author: "fixture-author", author_name: authorName },
	});
	let ready!: () => void, release!: () => void;
	const begun = new Promise<void>((r) => {
			ready = r;
		}),
		gate = new Promise<void>((r) => {
			release = r;
		});
	await page.route("**/api/v1/backgrounds/unsplash/**", async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/thumb")) {
			await route.fulfill({
				status: 200,
				contentType: "image/jpeg",
				body: bytes,
			});
			return;
		}
		const query = url.searchParams.get("s") ?? "",
			pageNumber = Number(url.searchParams.get("page") ?? 1);
		if (query === "Old") {
			ready();
			await gate;
			await route
				.fulfill({ json: [photo("old-photo", "Old fixture author")] })
				.catch(() => {});
			return;
		}
		await route.fulfill({
			json: [
				photo(
					`${query || "default"}-${pageNumber}`,
					`${query || "Default"} fixture author ${pageNumber}`,
				),
			],
		});
	});
	await page.route("**/api/v1/projects/1/backgrounds/unsplash", (route) =>
		route.fulfill({
			status: 503,
			json: { message: "Fixture provider selection unavailable" },
		}),
	);
	await page.goto("/projects/1/settings/background");
	await expect(
		page.getByRole("button", { name: "Default fixture author 1", exact: true }),
	).toBeVisible();
	await expect(page.locator(".image-search__image").first()).toHaveAttribute(
		"src",
		/^blob:/,
	);
	await page
		.getByRole("button", { name: "Load more photos", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Default fixture author 2", exact: true }),
	).toBeVisible();
	const search = page.getByPlaceholder("Search for a background…");
	await search.fill("Old");
	await begun;
	await search.fill("New");
	await expect(
		page.getByRole("button", { name: "New fixture author 1", exact: true }),
	).toBeVisible();
	release();
	await expect(
		page.getByRole("button", { name: "Old fixture author", exact: true }),
	).toHaveCount(0);
	await expect(search).toBeFocused();
	const requested = page.waitForRequest(
		(r) =>
			r.url().endsWith("/projects/1/backgrounds/unsplash") &&
			r.method() === "POST",
	);
	await page
		.getByRole("button", { name: "New fixture author 1", exact: true })
		.click();
	expect((await requested).postDataJSON().id).toBe("New-1");
	await expect(
		page.locator(".modal-content [data-error][role=alert]"),
	).toContainText("Fixture provider selection unavailable");
	await expect(search).toHaveValue("New");
	await page.keyboard.press("Escape");
	await expect(page.locator("dialog")).not.toBeVisible();
});
test("public shared background displays actual uploaded image without management controls", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/projects/1/settings/background");
	await upload(page);
	await LinkShareFactory.create(1, {
		hash: "background-public",
		project_id: 1,
		permission: 0,
	});
	await page.goto("/share/background-public/auth");
	await expect(page.locator(".link-share-container")).toHaveClass(
		/has-background/,
	);
	await expect(background(page)).toHaveClass(/is-visible/);
	await expect(
		page.getByRole("button", {
			name: "Choose a background from your pc",
			exact: true,
		}),
	).toHaveCount(0);
	await page.reload();
	await expect(background(page)).toHaveClass(/is-visible/);
});
test("home import prompt distinguishes empty account from filtered empty and deletion warning", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.route("**/api/v1/info", async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			json: { ...(await response.json()), available_migrators: ["todoist"] },
		});
	});
	await page.clock.setFixedTime(new Date("2026-10-05T12:00:00Z"));
	await page.goto("/?labels=98765");
	await expect(
		page.getByRole("link", {
			name: "Import your data into Vikunja",
			exact: true,
		}),
	).toHaveCount(0);
	await TaskFactory.create(0);
	await UserFactory.create(1, {
		id: 1,
		username: "migration-reviewer",
		deletion_scheduled_at: "2026-10-12T12:00:00Z",
	});
	await page.goto("/");
	await expect(page.locator("body")).toContainText(
		/We will delete your Vikunja account at in 7 days \(in 7 days\)/,
	);
	await expect(
		page.getByRole("link", {
			name: "Import your data into Vikunja",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: "Import your data into Vikunja",
			exact: true,
		}),
	).toHaveAttribute("href", "/user/settings/migrate");
	await expect(
		page.getByRole("link", { name: /cancel.*delet/i }),
	).toHaveAttribute("href", "/user/settings/deletion");
	await expect(page.locator(".llama-cool")).toBeVisible();
	await page.screenshot({
		path: info.outputPath("home-empty-deletion.png"),
		animations: "disabled",
	});
	const userResponse = await apiContext.get("user", {
		headers: await auth(page),
	});
	expect(userResponse.ok()).toBeTruthy();
	const settings = (await userResponse.json()).settings;
	const saved = await apiContext.post("user/settings/general", {
		headers: await auth(page),
		data: {
			...settings,
			frontend_settings: {
				...settings.frontend_settings,
				date_display: "yyyy-mm-dd",
				time_format: "24h",
			},
		},
	});
	expect(saved.ok()).toBeTruthy();
	await page.reload();
	await expect(page.locator("body")).toContainText(
		"We will delete your Vikunja account at 2026-10-12 12:00 (in 7 days).",
	);
	const result = await apiContext.get("tasks", {
		headers: await auth(page),
	});
	expect(result.ok()).toBeTruthy();
	expect(await result.json()).toHaveLength(0);
});

test("upcoming keeps readonly project task completion disabled with actual permission metadata", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await UserFactory.create(1, { id: 3, username: "readonly-owner" }, false);
	await ProjectFactory.create(
		1,
		{ id: 3, owner_id: 3, title: "Readonly upcoming" },
		false,
	);
	await createDefaultViews(3, 9);
	await UserProjectFactory.create(1, {
		project_id: 3,
		user_id: 1,
		permission: 0,
	});
	await TaskFactory.create(
		1,
		{
			id: 6,
			project_id: 3,
			title: "Readonly upcoming task",
			due_date: "2026-10-07T12:00:00Z",
		},
		false,
	);
	await page.goto(rangeURL);
	const row = page
		.locator(".single-task")
		.filter({ hasText: "Readonly upcoming task" });
	await expect(row.getByRole("checkbox")).toBeDisabled();
	const result = await apiContext.post("tasks/6", {
		headers: await auth(page),
		data: { done: true },
	});
	expect([403, 404]).toContain(result.status());
	expect(
		(
			await (
				await apiContext.get("tasks/6", { headers: await auth(page) })
			).json()
		).done,
	).toBeFalsy();
});

for (const width of [1440, 769, 390]) test(`project menu keyboard pointer and repeated navigation ${width}`, async ({authenticatedPage: page}, info) => {
 await page.setViewportSize({width, height: 900})
 for (const id of [1, 2, 1]) {
  await page.goto(`/projects/${id}/${id === 1 ? 1 : 5}`)
  const trigger = page.getByRole('banner').getByRole('button', {name: 'Open project settings menu'})
  await trigger.focus(); await page.keyboard.press('Enter')
  const backgroundLink = page.getByRole('link', {name: 'Background settings', exact: true})
  await expect(backgroundLink).toBeVisible()
  await expect.poll(async () => {const box = await backgroundLink.boundingBox(); return Boolean(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900)}).toBe(true)
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', {name: 'Duplicate', exact: true})).toBeFocused()
  await page.keyboard.press('Escape'); await expect(backgroundLink).toBeHidden(); await expect(trigger).toBeFocused()
  await trigger.click(); await backgroundLink.click(); await expect(page).toHaveURL(new RegExp(`/projects/${id}/settings/background$`))
  const dialog = page.locator('dialog[open]'); await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(el => ({border: getComputedStyle(el).borderTopWidth, width: el.getBoundingClientRect().width}))).toEqual({border: '0px', width})
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
 }
 await page.screenshot({path: info.outputPath(`menu-frame-${width}.png`), animations: 'disabled'})
})

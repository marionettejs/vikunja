import type { Page, Route } from "@playwright/test";
// Frontend contracts only. No license is generated or installed; direct backend requests stay gated.
export async function proContract(
	page: Page,
	{ admin = true, features = ["admin_panel", "time_tracking"] } = {},
) {
	const calls: { method: string; path: string; body: any; query: string }[] =
			[],
		users = [
			{
				id: 1,
				username: "migration-reviewer",
				email: "reviewer@example.test",
				status: 0,
				is_admin: admin,
				created: "2026-01-01T00:00:00Z",
				updated: "2026-01-01T00:00:00Z",
			},
			{
				id: 2,
				username: "contract-local",
				email: "local@example.test",
				status: 0,
				is_admin: false,
				created: "2026-01-01T00:00:00Z",
				updated: "2026-01-01T00:00:00Z",
			},
			{
				id: 3,
				username: "contract-oidc",
				email: "oidc@example.test",
				status: 0,
				is_admin: false,
				auth_provider: "fixture",
				issuer: "https://fixture.invalid",
				subject: "contract-subject",
				created: "2026-01-01T00:00:00Z",
				updated: "2026-01-01T00:00:00Z",
			},
		],
		entries: any[] = [];
	let nextId = 100,
		reject: string | undefined,
		delay: string | undefined,
		release: (() => void) | undefined;
	const hold = async (path: string) => {
		if (delay && path.includes(delay)) {
			delay = undefined;
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		}
	};
	await page.route("**/api/v1/info", async (route) => {
		const response = await route.fetch(),
			data = await response.json();
		await route.fulfill({
			response,
			json: { ...data, enabled_pro_features: features },
		});
	});
	await page.route("**/api/v1/user", async (route) => {
		if (route.request().method() !== "GET") return route.continue();
		const response = await route.fetch(),
			data = await response.json();
		await route.fulfill({ response, json: { ...data, is_admin: admin } });
	});
	const handle = async (route: Route) => {
		const request = route.request(),
			url = new URL(request.url()),
			path = url.pathname,
			method = request.method(),
			body = request.postDataJSON();
		calls.push({ method, path, body, query: url.search });
		await hold(path + url.search);
		if (reject && path.includes(reject)) {
			reject = undefined;
			return route.fulfill({
				status: 503,
				json: { message: "Isolated frontend contract rejection" },
			});
		}
		let data: any;
		if (path.includes("/admin/overview"))
			data = {
				users: 3,
				projects: 1,
				tasks: 1,
				teams: 0,
				shares: { link_shares: 1, team_shares: 2, user_shares: 3 },
				license: {
					licensed: true,
					instance_id: "frontend-contract-only",
					features,
					max_users: 10,
					expires_at: "2027-01-01T00:00:00Z",
					validated_at: "2026-01-01T00:00:00Z",
					last_check_failed: false,
				},
			};
		else if (path.includes("/admin/projects")) {
			if (method === "PATCH") data = {};
			else {
				const response = await page.request.get(
					url.origin + "/api/v1/projects",
					{ headers: { Authorization: request.headers().authorization } },
				);
				data = await response.json();
			}
		} else if (path.includes("/admin/users")) {
			const id = Number(/\/users\/(\d+)/.exec(path)?.[1]),
				u = users.find((u) => u.id === id);
			if (method === "GET")
				data = users.filter(
					(u) =>
						!url.searchParams.get("s") ||
						`${u.username} ${u.email}`.includes(url.searchParams.get("s")!),
				);
			else if (method === "POST" && path.endsWith("/users")) {
				data = {
					id: nextId++,
					username: body.username,
					email: body.email,
					status: 0,
					is_admin: body.isAdmin ?? false,
					created: "2026-01-01T00:00:00Z",
					updated: "2026-01-01T00:00:00Z",
				};
				users.push(data);
			} else if (method === "DELETE") {
				if (url.searchParams.get("mode") === "now")
					users.splice(users.indexOf(u!), 1);
				data = { message: "deleted" };
			} else {
				if (u && path.endsWith("/admin")) u.is_admin = body.is_admin;
				if (u && path.endsWith("/status")) u.status = body.status;
				data = u ?? { message: "sent" };
			}
		} else if (path.includes("/time-entries")) {
			const id = Number(/\/time-entries\/(\d+)/.exec(path)?.[1]);
			if (method === "GET") {
				const filter = url.searchParams.get("filter") ?? "",
					active = filter.includes("end_time = null"),
					taskId = Number(/task_id = (\d+)/.exec(filter)?.[1]);
				const items = entries.filter(
					(e) =>
						(!active || e.end_time === null) &&
						(!taskId || e.task_id === taskId),
				);
				data = {
					items,
					total: items.length,
					page: 1,
					per_page: 250,
					total_pages: 1,
				};
			} else if (path.endsWith("/timer/stop")) {
				data = entries.find((e) => !e.end_time);
				if (data) data.end_time = new Date().toISOString();
				else
					return route.fulfill({
						status: 409,
						json: { message: "No running timer" },
					});
			} else if (method === "POST") {
				data = {
					id: nextId++,
					user_id: 1,
					task_id: 0,
					project_id: 0,
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					end_time: null,
					max_permission: 2,
					...body,
				};
				entries.push(data);
			} else if (method === "PUT") {
				data = entries.find((e) => e.id === id);
				Object.assign(data, body);
				if (!body.task_id && !body.project_id) {
					data.task_id = entries.find((e) => e.id === id)?.task_id ?? 0;
				}
			} else if (method === "DELETE") {
				entries.splice(
					entries.findIndex((e) => e.id === id),
					1,
				);
				data = {};
			}
		} else throw new Error(`Unspecified frontend contract ${method} ${path}`);
		await route.fulfill({
			json: data,
			headers: {
				"x-pagination-total-pages": "1",
				"x-pagination-result-count": String(
					Array.isArray(data) ? data.length : 1,
				),
			},
		});
	};
	await page.route(/\/api\/v[12]\/admin\//, handle);
	await page.route(/\/api\/v2\/time-entries(?:\/|\?|$)/, handle);
	return {
		calls,
		users,
		entries,
		rejectNext: (path: string) => {
			reject = path;
		},
		holdNext: (path: string) => {
			delay = path;
		},
		release: () => release?.(),
	};
}

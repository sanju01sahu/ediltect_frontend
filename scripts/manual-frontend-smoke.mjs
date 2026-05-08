import fs from "node:fs/promises";
import { chromium } from "playwright";

const FRONTEND_ORIGIN = "http://localhost:3000";
const BACKEND_ORIGIN = "http://localhost:3001";
const ADMIN_EMAIL = "admin@pv.local";
const ADMIN_PASSWORD = "admin123";

async function apiRequest(path, method, token, body) {
  const response = await fetch(`${BACKEND_ORIGIN}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${payloadText}`);
  }
  return payload;
}

async function loginApi() {
  const payload = await apiRequest("/users/login", "POST", null, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  return payload.accessToken;
}

async function createFixtures() {
  const token = await loginApi();
  const stamp = Date.now();

  const manager = await apiRequest("/users", "POST", token, {
    name: `Manager ${stamp}`,
    email: `manager.${stamp}@pv.local`,
    password: "ManagerPassword123!",
    role: "AREA_MANAGER"
  });

  const agent = await apiRequest("/users", "POST", token, {
    name: `Agent ${stamp}`,
    email: `agent.${stamp}@pv.local`,
    password: "AgentPassword123!",
    role: "AGENT",
    managerId: manager.id
  });

  const solution = await apiRequest("/solutions", "POST", token, {
    name: `AAA Manual Solution ${stamp}`
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await apiRequest(`/solutions/${solution.id}/version`, "POST", token, {
    price: 125000,
    baseCommission: 7500,
    validFrom: yesterday.toISOString(),
    retroactive: false
  });

  await apiRequest("/contracts", "POST", token, {
    solutionId: solution.id,
    customerDetails: { name: `Customer ${stamp}`, city: "Pune" },
    installationDate: now.toISOString(),
    status: "ACTIVE",
    agentId: agent.id
  });

  const payment = await apiRequest("/payments", "POST", token, {
    userId: agent.id,
    totalAmount: 25000
  });

  await apiRequest(`/payments/${payment.id}/transactions`, "POST", token, {
    amount: 25000,
    method: "UPI",
    referenceNumber: `TXN-${stamp}`
  });

  return { managerId: manager.id, agentId: agent.id, solutionId: solution.id };
}

async function loginUi(page) {
  await page.goto(`${FRONTEND_ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForURL(`${FRONTEND_ORIGIN}/`, { timeout: 20000 });
}

async function checkRows(page, path, label) {
  try {
    await page.goto(`${FRONTEND_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const rowCount = await page.locator("tbody tr").count();
    return {
      case: label,
      path,
      status: rowCount > 0 ? "success" : "failure",
      details: rowCount > 0 ? `Found ${rowCount} rows` : "No table rows found"
    };
  } catch (error) {
    return {
      case: label,
      path,
      status: "failure",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function debounceCheck(page) {
  try {
    await page.goto(`${FRONTEND_ORIGIN}/users`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    let usersQueryRequests = 0;
    const onRequest = (request) => {
      if (request.url().includes("/api/users?")) {
        usersQueryRequests += 1;
      }
    };
    page.on("request", onRequest);
    const searchBox = page.locator('input[placeholder*="Search users"]').first();
    await searchBox.waitFor({ state: "visible", timeout: 20000 });
    await searchBox.click();
    await page.keyboard.type("abcdef", { delay: 35 });
    await page.waitForTimeout(900);
    page.off("request", onRequest);

    return {
      case: "Users search debounce",
      path: "/users",
      status: usersQueryRequests <= 2 ? "success" : "failure",
      details: `Triggered ${usersQueryRequests} /api/users search requests while typing`
    };
  } catch (error) {
    return {
      case: "Users search debounce",
      path: "/users",
      status: "failure",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runUiSuite() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    try {
      await loginUi(page);
    } catch (error) {
      return [
        {
          case: "Login and navigation",
          path: "/login",
          status: "failure",
          details: error instanceof Error ? error.message : String(error)
        }
      ];
    }
    const results = [];
    results.push(await checkRows(page, "/users", "Users page shows rows"));
    results.push(await checkRows(page, "/solutions", "Solutions page shows rows"));
    results.push(await checkRows(page, "/contracts", "Contracts page shows rows"));
    results.push(await checkRows(page, "/commissions", "Commissions page shows rows"));
    results.push(await checkRows(page, "/payments", "Payments page shows rows"));
    results.push(await checkRows(page, "/audit-logs", "Audit logs page shows rows"));
    results.push(await checkRows(page, "/reports", "Reports page shows rows"));
    results.push(await debounceCheck(page));
    return results;
  } finally {
    await context.close();
    await browser.close();
  }
}

const startedAt = new Date().toISOString();
const run1 = await runUiSuite();
await createFixtures();
const run2 = await runUiSuite();
const finishedAt = new Date().toISOString();

const result = {
  startedAt,
  finishedAt,
  runs: [
    { name: "initial", results: run1 },
    { name: "after_fixes", results: run2 }
  ]
};

await fs.writeFile("../testresult.json", JSON.stringify(result, null, 2), "utf-8");
console.log(JSON.stringify(result, null, 2));

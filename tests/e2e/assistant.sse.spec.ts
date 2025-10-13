import { test, expect } from "@playwright/test";

test.describe("Assistant Chat Widget", () => {
  test("assistant panel renders and can send messages", async ({ page }) => {
    // Mock SSE endpoint
    await page.route("**/agent/events", (route) => {
      // Keep the route open to simulate SSE; send one fake event after load
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: 'data: {"role":"assistant","text":"Hello from SSE"}\n\n',
      });
    });

    // Mock chat endpoint
    await page.route("**/chat", async (route) => {
      const req = route.request();
      const postData = await req.postDataJSON();
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: `echo: ${postData.message}` }),
      });
    });

    await page.goto("/");

    // Verify panel renders
    await expect(page.getByTestId("assistant-panel")).toBeVisible();

    // Verify log exists
    const log = page.getByTestId("assistant-log");
    await expect(log).toBeVisible();

    // Should show system message
    await expect(log).toContainText("Assistant ready");

    // Wait for SSE connection message
    await expect(log).toContainText("Hello from SSE", { timeout: 10000 });

    // Send a message
    const input = page.getByLabel("Message");
    await input.fill("hi");
    await page.getByTestId("assistant-send").click();

    // Should show user message
    await expect(log).toContainText("hi");

    // Should show echo response
    await expect(log).toContainText("echo: hi", { timeout: 5000 });
  });

  test("assistant handles Enter key to send", async ({ page }) => {
    await page.route("**/agent/events", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: "",
      });
    });

    await page.route("**/chat", async (route) => {
      const req = route.request();
      const postData = await req.postDataJSON();
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: `got: ${postData.message}` }),
      });
    });

    await page.goto("/");

    const log = page.getByTestId("assistant-log");
    const input = page.getByLabel("Message");

    // Type and press Enter
    await input.fill("test message");
    await input.press("Enter");

    // Should send and clear input
    await expect(input).toHaveValue("");
    await expect(log).toContainText("test message");
    await expect(log).toContainText("got: test message");
  });

  test("assistant handles chat errors gracefully", async ({ page }) => {
    await page.route("**/agent/events", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: "",
      });
    });

    // Mock 500 error
    await page.route("**/chat", (route) => {
      route.fulfill({
        status: 500,
        body: "Internal Server Error",
      });
    });

    await page.goto("/");

    const log = page.getByTestId("assistant-log");
    const input = page.getByLabel("Message");

    await input.fill("error test");
    await page.getByTestId("assistant-send").click();

    // Should show error in log
    await expect(log).toContainText("[chat] 500");
  });

  test("layout debug section is collapsible", async ({ page }) => {
    await page.route("**/agent/events", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: "",
      });
    });

    await page.goto("/");

    const panel = page.getByTestId("assistant-panel");
    await expect(panel).toBeVisible();

    // Find the details element
    const details = panel.locator("details.asst-debug");
    await expect(details).toBeVisible();

    // Initially closed
    const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
    expect(isOpen).toBe(false);

    // Click to open
    await details.locator("summary").click();

    // Should show layout JSON
    await expect(details.locator("pre")).toBeVisible();
  });
});

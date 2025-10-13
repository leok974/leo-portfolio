import { test, expect } from "@playwright/test";

test("chat streams tokens via /chat/stream while posting /chat", async ({ page }) => {
  // Mock POST /chat — accept channel and reply 200
  await page.route("**/chat", async route => {
    const req = await route.request().postDataJSON();
    expect(req.channel).toBeTruthy();
    route.fulfill({ status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) });
  });

  // Mock SSE /chat/stream — send a few tokens and a [DONE]
  await page.route("**/chat/stream*", async route => {
    const body =
      "data: Hello\n\n" +
      "data:  world\n\n" +
      "data: !\n\n" +
      "data: [DONE]\n\n";
    route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body });
  });

  await page.goto("/");
  await expect(page.getByTestId("assistant-panel")).toBeVisible();

  // Send a message
  await page.getByLabel("Message").fill("hi");
  await page.getByTestId("assistant-send").click();

  // Expect streamed content to appear
  await expect(page.getByTestId("assistant-log")).toContainText("Hello");
  await expect(page.getByTestId("assistant-log")).toContainText("world");
  await expect(page.getByTestId("assistant-log")).toContainText("!");
  await expect(page.getByTestId("assistant-log")).toContainText("[chat] done");
});

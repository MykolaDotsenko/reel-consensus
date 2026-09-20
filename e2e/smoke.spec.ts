import { expect, test } from "@playwright/test";

test("group decision flow works on desktop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /stop scrolling/i })).toBeVisible();

  await page.getByRole("button", { name: /find our movie/i }).click();
  await expect(page.getByRole("heading", { name: /best compromises, explained/i })).toBeVisible();
  await expect(page.getByText(/group fit/i).first()).toBeVisible();
});

test("hard constraints can create and recover from an empty result set", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "90 min" }).click();
  await page.getByRole("button", { name: "7.5+" }).click();

  await page.getByRole("button", { name: "Action" }).last().click();
  await page.getByRole("button", { name: "Adventure" }).last().click();
  await page.getByRole("button", { name: "Animation" }).last().click();
  await page.getByRole("button", { name: "Comedy" }).last().click();
  await page.getByRole("button", { name: "Crime" }).last().click();
  await page.getByRole("button", { name: "Drama" }).last().click();
  await page.getByRole("button", { name: "Fantasy" }).last().click();
  await page.getByRole("button", { name: "Horror" }).last().click();
  await page.getByRole("button", { name: "Mystery" }).last().click();
  await page.getByRole("button", { name: "Romance" }).last().click();
  await page.getByRole("button", { name: "Sci Fi" }).last().click();
  await page.getByRole("button", { name: "Thriller" }).last().click();

  await page.getByRole("button", { name: /find our movie/i }).click();
  await expect(page.getByText(/no fair match survives/i)).toBeVisible();
  await page.getByRole("button", { name: /relax group constraints/i }).click();
});

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

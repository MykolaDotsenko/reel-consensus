import { expect, test } from "@playwright/test";

test("group decision flow works on desktop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /one movie/i })).toBeVisible();

  await page.getByRole("button", { name: /find our movie/i }).click();
  await expect(page.getByRole("heading", { name: /best compromises, explained/i })).toBeVisible();
  await expect(page.getByText(/group fit/i).first()).toBeVisible();
  await expect(page.getByText(/best compromise/i).first()).toBeVisible();
});

test("hard constraints can create and recover from an empty result set", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "90 min" }).click();
  await page.getByText("More hard limits", { exact: true }).click();

  const advanced = page.locator(".advanced-limits");
  await advanced.getByRole("button", { name: "7.5+" }).click();

  for (const genre of [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Drama",
    "Fantasy",
    "Horror",
    "Mystery",
    "Romance",
    "Sci Fi",
    "Thriller",
  ]) {
    await advanced.getByRole("button", { name: genre }).click();
  }

  await page.getByRole("button", { name: /find our movie/i }).click();
  await expect(page.getByText(/no fair match survives/i)).toBeVisible();
  await page.getByRole("button", { name: /relax group constraints/i }).click();
});

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

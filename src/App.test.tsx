import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("runs the demo group through the decision engine", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /find our movie/i }));

    expect(screen.getByRole("heading", { name: /best compromises, explained/i })).toBeInTheDocument();
    expect(screen.getAllByText(/group fit/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /not tonight/i }).length).toBeGreaterThan(0);
  });

  it("can add another participant", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /add another person/i }));
    expect(screen.getByLabelText("Participant 3 name")).toHaveValue("Guest 3");
  });
});

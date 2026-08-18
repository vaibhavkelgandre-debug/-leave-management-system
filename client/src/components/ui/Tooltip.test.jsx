import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip.jsx";

describe("Tooltip", () => {
    it("renders the label and the children together", () => {
        render(
            <Tooltip label="Edit item">
                <button>Icon</button>
            </Tooltip>
        );

        expect(screen.getByRole("button", { name: /icon/i })).toBeInTheDocument();
        expect(screen.getByRole("tooltip")).toHaveTextContent("Edit item");
    });

    it("renders just the children, with no tooltip element, when there's no label", () => {
        render(
            <Tooltip>
                <button>Icon</button>
            </Tooltip>
        );

        expect(screen.getByRole("button", { name: /icon/i })).toBeInTheDocument();
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("never sets a native title attribute — this exists specifically to replace that", () => {
        render(
            <Tooltip label="Delete item">
                <button>Icon</button>
            </Tooltip>
        );

        expect(screen.getByRole("button", { name: /icon/i })).not.toHaveAttribute("title");
    });

    describe("portal mode", () => {
        it("renders nothing until hovered/focused, then shows the label positioned fixed in the viewport", async () => {
            render(
                <Tooltip label="Dashboard" portal>
                    <a href="/dashboard">Icon</a>
                </Tooltip>
            );

            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

            await userEvent.hover(screen.getByRole("link"));
            const tooltip = await screen.findByRole("tooltip");
            expect(tooltip).toHaveTextContent("Dashboard");
            expect(tooltip.style.position).toBe("fixed");

            await userEvent.unhover(screen.getByRole("link"));
            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
        });

        it("is appended to document.body, not nested inside the trigger's own DOM subtree", async () => {
            const { container } = render(
                <Tooltip label="Dashboard" portal>
                    <a href="/dashboard">Icon</a>
                </Tooltip>
            );

            await userEvent.hover(screen.getByRole("link"));
            const tooltip = await screen.findByRole("tooltip");

            expect(container.contains(tooltip)).toBe(false);
            expect(document.body.contains(tooltip)).toBe(true);
        });
    });
});

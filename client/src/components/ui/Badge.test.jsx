import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, RoleBadge } from "./Badge.jsx";
import { ROLES } from "../../constants/roles.js";

describe("Badge", () => {
    // A badge is an inline <span>, so a two-word label in a narrow table column
    // wrapped mid-pill and split the rounded background into two half-pills
    // stacked on each other — which read as a rendering glitch. Pinned because
    // it's a one-class fix that a later "tidy the class list" pass could drop
    // without anything else failing.
    it("never breaks a multi-word label across lines", () => {
        render(<RoleBadge role={ROLES.SUPER_ADMIN} />);

        expect(screen.getByText("Super Admin")).toHaveClass("whitespace-nowrap");
    });

    it("keeps a caller's own classes alongside the base ones", () => {
        render(<Badge className="flex items-center bg-amber-100">Half day</Badge>);
        const badge = screen.getByText("Half day");

        expect(badge).toHaveClass("flex", "items-center", "bg-amber-100", "rounded-full", "whitespace-nowrap");
    });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaveBalanceCard } from "./LeaveBalanceCard.jsx";
import { LEAVE_BALANCE_ACCENTS } from "../../constants/leaveBalanceAccents.js";

const accent = LEAVE_BALANCE_ACCENTS[0];

describe("LeaveBalanceCard", () => {
    it("shows the remaining days and the entitlement/taken/pending breakdown", () => {
        const balance = {
            id: "b1",
            leave_type_name: "Casual Leave",
            entitlement: "12",
            days_taken: "4",
            days_pending: "1",
            days_remaining: "7",
        };
        render(<LeaveBalanceCard balance={balance} accent={accent} />);

        expect(screen.getByText("Casual Leave")).toBeInTheDocument();
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("warns when the balance is exhausted", () => {
        const balance = { id: "b2", leave_type_name: "Sick Leave", entitlement: "5", days_taken: "5", days_pending: "0", days_remaining: "0" };
        render(<LeaveBalanceCard balance={balance} accent={accent} />);
        expect(screen.getByText(/all out for now/i)).toBeInTheDocument();
    });
});

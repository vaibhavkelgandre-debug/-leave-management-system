import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaveBalanceCard } from "./LeaveBalanceCard.jsx";
import { LEAVE_BALANCE_ACCENTS } from "../../constants/leaveBalanceAccents.js";

const balance = {
    id: 1,
    leave_type_name: "Annual Leave",
    entitlement: "20",
    days_taken: "3",
    days_pending: "2",
    days_remaining: "15",
};

describe("LeaveBalanceCard", () => {
    it("renders the leave type name and remaining days", () => {
        render(<LeaveBalanceCard balance={balance} accent={LEAVE_BALANCE_ACCENTS[0]} />);

        expect(screen.getByText("Annual Leave")).toBeInTheDocument();
        expect(screen.getByText("15")).toBeInTheDocument();
        expect(screen.getByText("days left")).toBeInTheDocument();
    });

    it("renders the taken/pending/entitled caption", () => {
        render(<LeaveBalanceCard balance={balance} accent={LEAVE_BALANCE_ACCENTS[0]} />);

        expect(screen.getByText("3 taken · 2 pending · 20 entitled")).toBeInTheDocument();
    });
});

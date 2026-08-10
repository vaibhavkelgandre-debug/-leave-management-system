import { describe, it, expect } from "vitest";
import { groupEmployeesForOrgView } from "./employeeGroups.js";

function user(id, firstName, role, managerId = null) {
    return { id, first_name: firstName, role, manager_id: managerId };
}

describe("groupEmployeesForOrgView", () => {
    it("puts every HR_ADMIN in leadership, sorted by first name", () => {
        const users = [user("hr-b", "Bilal", "HR_ADMIN"), user("hr-a", "Amit", "HR_ADMIN")];
        const { leadership } = groupEmployeesForOrgView(users);
        expect(leadership.map((u) => u.id)).toEqual(["hr-a", "hr-b"]);
    });

    it("gives every MANAGER their own team, with their direct EMPLOYEE reports sorted inside it", () => {
        const users = [
            user("hr", "Priya", "HR_ADMIN"),
            user("mgr", "Amit", "MANAGER", "hr"),
            user("emp-z", "Zara", "EMPLOYEE", "mgr"),
            user("emp-d", "Deepa", "EMPLOYEE", "mgr"),
        ];
        const { teams } = groupEmployeesForOrgView(users);
        expect(teams).toHaveLength(1);
        expect(teams[0].manager.id).toBe("mgr");
        expect(teams[0].reports.map((u) => u.id)).toEqual(["emp-d", "emp-z"]);
    });

    it("orders teams by the manager's first name", () => {
        const users = [
            user("hr", "Priya", "HR_ADMIN"),
            user("mgr-b", "Bilal", "MANAGER", "hr"),
            user("mgr-a", "Amit", "MANAGER", "hr"),
        ];
        const { teams } = groupEmployeesForOrgView(users);
        expect(teams.map((team) => team.manager.id)).toEqual(["mgr-a", "mgr-b"]);
    });

    it("includes a MANAGER with nobody reporting to them yet as an empty team, not a missing one", () => {
        const users = [user("hr", "Priya", "HR_ADMIN"), user("mgr", "Amit", "MANAGER", "hr")];
        const { teams } = groupEmployeesForOrgView(users);
        expect(teams).toEqual([{ manager: users[1], reports: [] }]);
    });

    it("puts an employee who reports straight to HR (no manager in between) in unassigned, not dropped", () => {
        const users = [user("hr", "Priya", "HR_ADMIN"), user("emp", "Zara", "EMPLOYEE", "hr")];
        const { teams, unassigned } = groupEmployeesForOrgView(users);
        expect(teams).toEqual([]);
        expect(unassigned.map((u) => u.id)).toEqual(["emp"]);
    });

    it("puts an employee whose manager_id doesn't resolve to anyone in unassigned instead of dropping them", () => {
        const users = [user("emp", "Zara", "EMPLOYEE", "no-such-user")];
        const { unassigned } = groupEmployeesForOrgView(users);
        expect(unassigned.map((u) => u.id)).toEqual(["emp"]);
    });

    it("never puts a MANAGER themself into unassigned", () => {
        const users = [user("hr", "Priya", "HR_ADMIN"), user("mgr", "Amit", "MANAGER", "hr")];
        const { unassigned } = groupEmployeesForOrgView(users);
        expect(unassigned).toEqual([]);
    });
});

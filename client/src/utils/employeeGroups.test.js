import { describe, it, expect } from "vitest";
import { groupEmployeesForOrgView, groupTeamByManager } from "./employeeGroups.js";

function user(id, firstName, role, managerId = null) {
    return { id, first_name: firstName, role, manager_id: managerId };
}

describe("groupEmployeesForOrgView", () => {
    it("puts every HR_ADMIN in leadership, sorted by first name", () => {
        const users = [user("hr-b", "Bilal", "HR_ADMIN"), user("hr-a", "Amit", "HR_ADMIN")];
        const { leadership } = groupEmployeesForOrgView(users);
        expect(leadership.map((u) => u.id)).toEqual(["hr-a", "hr-b"]);
    });

    it("puts SUPER_ADMIN in leadership alongside HR_ADMIN, not unassigned", () => {
        const users = [user("super", "Sam", "SUPER_ADMIN"), user("hr", "Priya", "HR_ADMIN", "super")];
        const { leadership, unassigned } = groupEmployeesForOrgView(users);
        expect(leadership.map((u) => u.id).sort()).toEqual(["hr", "super"]);
        expect(unassigned).toEqual([]);
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

describe("groupTeamByManager", () => {
    // My Team's extended-team grouping: one entry per manager, so the page can
    // render a table per manager instead of a flat list with a Reports To
    // column. Managers are resolved from `directory`, not from `people` — an
    // extended-team member's manager is usually one of the viewer's own direct
    // reports, so they aren't in the list being grouped.
    it("groups people under their own manager, sorted by manager then report", () => {
        const mgrB = user("mgr-b", "Bala", "MANAGER", "hr-1");
        const mgrA = user("mgr-a", "Asha", "MANAGER", "hr-1");
        const zara = user("emp-1", "Zara", "EMPLOYEE", "mgr-a");
        const nina = user("emp-2", "Nina", "EMPLOYEE", "mgr-a");
        const sam = user("emp-3", "Sam", "EMPLOYEE", "mgr-b");

        const { groups, ungrouped } = groupTeamByManager([zara, nina, sam], [mgrA, mgrB, zara, nina, sam]);

        expect(groups.map((group) => group.manager.first_name)).toEqual(["Asha", "Bala"]);
        expect(groups[0].reports.map((person) => person.first_name)).toEqual(["Nina", "Zara"]);
        expect(groups[1].reports.map((person) => person.first_name)).toEqual(["Sam"]);
        expect(ungrouped).toEqual([]);
    });

    it("collects anyone whose manager isn't in the directory rather than dropping them", () => {
        const orphan = user("emp-1", "Zara", "EMPLOYEE", "someone-else");
        const managerless = user("emp-2", "Nina", "EMPLOYEE", null);

        const { groups, ungrouped } = groupTeamByManager([orphan, managerless], [orphan, managerless]);

        expect(groups).toEqual([]);
        expect(ungrouped.map((person) => person.first_name)).toEqual(["Nina", "Zara"]);
    });
});

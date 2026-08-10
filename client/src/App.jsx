import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.jsx";
import { AcceptInvitePage } from "./pages/AcceptInvitePage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { TeamPage } from "./pages/TeamPage.jsx";
import { EmployeesPage } from "./pages/EmployeesPage.jsx";
import { MyBalancesPage } from "./pages/MyBalancesPage.jsx";
import { LeaveTypesPage } from "./pages/LeaveTypesPage.jsx";
import { HolidaysPage } from "./pages/HolidaysPage.jsx";
import { ApprovalsPage } from "./pages/ApprovalsPage.jsx";
import { DelegationsPage } from "./pages/DelegationsPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { ForbiddenPage } from "./pages/ForbiddenPage.jsx";
import { AppLayout } from "./components/layout/AppLayout.jsx";
import { RequireAuth } from "./components/routing/RequireAuth.jsx";
import { RequireRole } from "./components/routing/RequireRole.jsx";
import { PublicOnlyRoute } from "./components/routing/PublicOnlyRoute.jsx";
import { ROLES } from "./constants/roles.js";

function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />

            <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/invite/:token" element={<AcceptInvitePage />} />

            <Route element={<RequireAuth />}>
                <Route path="/dashboard" element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />

                    <Route path="my-leave" element={<MyBalancesPage />} />
                    {/* Everyone can view the holiday calendar; only HR sees the
                        add/delete controls inside the page. */}
                    <Route path="holidays" element={<HolidaysPage />} />

                    <Route element={<RequireRole allowedRoles={[ROLES.MANAGER, ROLES.HR_ADMIN]} />}>
                        <Route path="team" element={<TeamPage />} />
                    </Route>

                    {/* A plain EMPLOYEE who is currently someone's active
                        delegate also needs this page — see RequireRole.jsx. */}
                    <Route
                        element={<RequireRole allowedRoles={[ROLES.MANAGER, ROLES.HR_ADMIN]} alsoAllowIfActiveDelegate />}
                    >
                        <Route path="approvals" element={<ApprovalsPage />} />
                    </Route>

                    <Route element={<RequireRole allowedRoles={[ROLES.MANAGER]} />}>
                        <Route path="delegations" element={<DelegationsPage />} />
                    </Route>

                    <Route element={<RequireRole allowedRoles={[ROLES.HR_ADMIN]} />}>
                        <Route path="employees" element={<EmployeesPage />} />
                        <Route path="leave-types" element={<LeaveTypesPage />} />
                    </Route>

                    <Route path="403" element={<ForbiddenPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Route>
        </Routes>
    );
}

export default App;

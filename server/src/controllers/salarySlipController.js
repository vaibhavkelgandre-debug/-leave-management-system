// Thin HTTP glue for salary slips — every handler just pulls from `req`,
// calls one salarySlipService function, and reports success/failure. All
// business logic (LOP calculation, subtree scoping, the archive-then-
// overwrite commit) lives in the service, not here.
import * as salarySlipService from "../services/salarySlipService.js";
import { renderPayslipPdf } from "../services/payslipPdfService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function calculate(req, res, next) {
    try {
        const { payPeriod, role, profileStatus } = req.body;
        const result = await salarySlipService.calculatePayroll(req.user, payPeriod, { role, profileStatus });
        sendSuccess(res, 200, "Payroll calculated", result);
    } catch (error) {
        next(error);
    }
}

export async function confirm(req, res, next) {
    try {
        const { payPeriod, role, profileStatus } = req.body;
        const result = await salarySlipService.confirmPayroll(req.user, payPeriod, { role, profileStatus });
        sendSuccess(res, 200, "Payroll approved", result);
    } catch (error) {
        next(error);
    }
}

export async function listMine(req, res, next) {
    try {
        const slips = await salarySlipService.listMySalarySlips(req.user, req.query);
        sendSuccess(res, 200, "Salary slips retrieved", slips);
    } catch (error) {
        next(error);
    }
}

export async function listForHr(req, res, next) {
    try {
        // Paginated `{ slips, total }` — same envelope shape as the leave-request
        // and notification lists.
        const { rows, total } = await salarySlipService.listSalarySlipsForHr(req.user, req.query);
        sendSuccess(res, 200, "Salary slips retrieved", { slips: rows, total });
    } catch (error) {
        next(error);
    }
}

export async function getOne(req, res, next) {
    try {
        const slip = await salarySlipService.getSalarySlipById(req.user, req.params.id);
        sendSuccess(res, 200, "Salary slip retrieved", slip);
    } catch (error) {
        next(error);
    }
}

export async function voidSlip(req, res, next) {
    try {
        const slip = await salarySlipService.voidSalarySlip(req.user, req.params.id, req.body.reason);
        sendSuccess(res, 200, "Salary slip voided", slip);
    } catch (error) {
        next(error);
    }
}

// Reuses getSalarySlipById for the same visibility check before rendering
// anything — a PDF is never generated for a slip the caller couldn't
// already see via GET /:id.
//
// `?disposition=inline` (the only other value this ever becomes — anything
// else, including nothing, falls back to `attachment`, so this is never
// interpolated from the query string directly) lets the same stream serve
// two purposes: the default `attachment` is what the client's Download link
// still points at, forcing a real save; `inline` is what DocumentPreviewModal
// points at instead, so the browser renders the PDF in the viewer's <iframe>
// rather than triggering a download the instant it's opened — the bug this
// distinction exists to fix.
export async function downloadPdf(req, res, next) {
    try {
        const slip = await salarySlipService.getSalarySlipById(req.user, req.params.id);
        const disposition = req.query.disposition === "inline" ? "inline" : "attachment";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${disposition}; filename="payslip-${slip.pay_period}.pdf"`);
        const doc = renderPayslipPdf(slip);
        doc.on("error", next);
        doc.pipe(res);
    } catch (error) {
        next(error);
    }
}

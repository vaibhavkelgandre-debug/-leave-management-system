// Cycled by card position so a row of different leave types reads as a set of
// distinct little cards rather than identical grey boxes. Lives in its own
// file (not LeaveBalanceCard.jsx) so that component can stay a
// components-only export, which react-refresh requires.
export const LEAVE_BALANCE_ACCENTS = [
    { bg: "bg-indigo-100", text: "text-indigo-600", bar: "bg-indigo-500" },
    { bg: "bg-emerald-100", text: "text-emerald-600", bar: "bg-emerald-500" },
    { bg: "bg-amber-100", text: "text-amber-600", bar: "bg-amber-500" },
    { bg: "bg-rose-100", text: "text-rose-600", bar: "bg-rose-500" },
    { bg: "bg-sky-100", text: "text-sky-600", bar: "bg-sky-500" },
    { bg: "bg-violet-100", text: "text-violet-600", bar: "bg-violet-500" },
];

// One colour per leave type, stable across every surface that shows leave.
//
// The accents themselves are cycled by *position in the caller's balance
// list* (LEAVE_BALANCE_ACCENTS), not hashed from the name: with six accents
// and typically five leave types, a hash would sooner or later give two types
// the same colour, which reads as a bug. Position is stable because
// `GET /leave-balances/me` returns them in a consistent order, and it's the
// same rule the balance cards already used implicitly by mapping over that
// array with their index — this just makes the mapping explicit and shareable
// so a request row can be tinted to match its own type's card.
//
// Keyed by `leave_type_id`, which both a balance row and a leave request
// carry — never by name, which is user-editable (renaming a type would
// otherwise silently recolour its history).
import { LEAVE_BALANCE_ACCENTS } from "../constants/leaveBalanceAccents.js";

// For a leave type with no balance row of its own: a request can outlive its
// type being deactivated, and the history list still has to render it.
export const NEUTRAL_LEAVE_ACCENT = { bg: "bg-slate-100", text: "text-slate-600", bar: "bg-slate-400" };

// Input: the caller's balance rows, in the order the API returned them.
// Output: a `Map` from `leave_type_id` to one of LEAVE_BALANCE_ACCENTS.
export function buildLeaveTypeAccents(balances) {
    return new Map(
        balances.map((balance, index) => [
            balance.leave_type_id,
            LEAVE_BALANCE_ACCENTS[index % LEAVE_BALANCE_ACCENTS.length],
        ])
    );
}

// Convenience for the common "look this up, fall back to neutral" call.
export function accentFor(accents, leaveTypeId) {
    return accents.get(leaveTypeId) ?? NEUTRAL_LEAVE_ACCENT;
}

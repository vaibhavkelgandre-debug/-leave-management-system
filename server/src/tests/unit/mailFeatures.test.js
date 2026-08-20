// Unit tests for the outbound-email flag registry — the module that decides
// whether a given email is sent at all. Pure env-var logic, no transport and
// no database, so it's tested here rather than through an HTTP round trip.
//
// Worth testing directly despite being small: every flow's deliverability
// funnels through `isMailFeatureEnabled`, and the failure mode of a bug here
// is silent (emails simply stop, or start, with nothing in the logs pointing
// at the parser).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MAIL_FEATURES, isMailFeatureEnabled, describeMailFeatures } from "../../config/mailFeatures.js";

const MAIL_ENV_KEYS = [
    "MAIL_ENABLED",
    "MAIL_FEATURE_PASSWORD_RESET",
    "MAIL_FEATURE_EMPLOYEE_INVITE",
    "MAIL_FEATURE_SALARY_SLIP",
];

// The suite's own .env/.env.test may set any of these, so each test starts
// from "nothing configured" and the originals go back afterwards — otherwise
// a case that deletes a var would leak that into every later test file.
const originalEnv = {};

beforeEach(() => {
    for (const key of MAIL_ENV_KEYS) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of MAIL_ENV_KEYS) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});

describe("isMailFeatureEnabled", () => {
    it("defaults every flow to enabled when nothing is configured", () => {
        for (const feature of Object.values(MAIL_FEATURES)) {
            expect(isMailFeatureEnabled(feature)).toBe(true);
        }
    });

    it("disables a single flow without touching the others", () => {
        process.env.MAIL_FEATURE_SALARY_SLIP = "false";

        expect(isMailFeatureEnabled(MAIL_FEATURES.SALARY_SLIP)).toBe(false);
        expect(isMailFeatureEnabled(MAIL_FEATURES.EMPLOYEE_INVITE)).toBe(true);
        expect(isMailFeatureEnabled(MAIL_FEATURES.PASSWORD_RESET)).toBe(true);
    });

    it("accepts the spellings that actually turn up in a .env file", () => {
        for (const off of ["false", "FALSE", " off ", "0", "no", "disabled"]) {
            process.env.MAIL_FEATURE_EMPLOYEE_INVITE = off;
            expect(isMailFeatureEnabled(MAIL_FEATURES.EMPLOYEE_INVITE)).toBe(false);
        }
        for (const on of ["true", "TRUE", " on ", "1", "yes", "enabled"]) {
            process.env.MAIL_FEATURE_EMPLOYEE_INVITE = on;
            expect(isMailFeatureEnabled(MAIL_FEATURES.EMPLOYEE_INVITE)).toBe(true);
        }
    });

    // An empty or garbled value must not read as "off": a declared-but-blank
    // var is the most common .env state, and silently disabling password
    // recovery over it would be the worst possible interpretation.
    it("falls back to the default for a blank or unrecognized value", () => {
        for (const value of ["", "   ", "maybe", "tru"]) {
            process.env.MAIL_FEATURE_PASSWORD_RESET = value;
            expect(isMailFeatureEnabled(MAIL_FEATURES.PASSWORD_RESET)).toBe(true);
        }
    });

    it("lets MAIL_ENABLED=false override every per-feature flag", () => {
        process.env.MAIL_ENABLED = "false";
        process.env.MAIL_FEATURE_SALARY_SLIP = "true";

        for (const feature of Object.values(MAIL_FEATURES)) {
            expect(isMailFeatureEnabled(feature)).toBe(false);
        }
    });

    // A mistyped feature key would otherwise mean "this email quietly stopped
    // existing" — the one failure this module can't afford to be silent about.
    it("throws on an unknown feature key", () => {
        expect(() => isMailFeatureEnabled("PAYSLIP_REMINDER")).toThrow(/Unknown mail feature/);
    });
});

describe("describeMailFeatures", () => {
    it("reports every flow with its env var and current state", () => {
        process.env.MAIL_FEATURE_SALARY_SLIP = "false";

        const described = describeMailFeatures();

        expect(described).toHaveLength(Object.keys(MAIL_FEATURES).length);
        expect(described.every((row) => row.envVar && row.description)).toBe(true);
        expect(described.find((row) => row.feature === MAIL_FEATURES.SALARY_SLIP).enabled).toBe(false);
        expect(described.find((row) => row.feature === MAIL_FEATURES.EMPLOYEE_INVITE).enabled).toBe(true);
    });
});

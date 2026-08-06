const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
    return EMAIL_PATTERN.test(value);
}

export function validateLoginForm({ email, password }) {
    const errors = {};

    if (!email) {
        errors.email = "Email is required";
    } else if (!isValidEmail(email)) {
        errors.email = "Enter a valid email address";
    }

    if (!password) {
        errors.password = "Password is required";
    }

    return errors;
}

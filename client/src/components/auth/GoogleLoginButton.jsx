import { GoogleLogin } from "@react-oauth/google";

// Thin adapter around the third-party Google button: unwraps the library's
// credentialResponse into a plain ID token so callers (LoginForm) don't need
// to know anything about the @react-oauth/google response shape.
export function GoogleLoginButton({ onSuccess, onError }) {
    return (
        <GoogleLogin
            onSuccess={(credentialResponse) => onSuccess(credentialResponse.credential)}
            onError={onError}
            useOneTap={false}
        />
    );
}

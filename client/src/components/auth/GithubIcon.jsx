// lucide-react dropped brand/logo icons (including GitHub's) a while back —
// only generic git-action icons remain, none of which are the actual mark —
// so the "Sign in with GitHub" button needs its own inline SVG to look as
// recognizable as the Google button's icon (rendered by @react-oauth/google).
export function GithubIcon({ className, ...rest }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...rest}>
            <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 4.94 3.2 9.13 7.65 10.6.56.1.76-.24.76-.54 0-.27-.01-1.17-.02-2.12-3.11.68-3.77-1.32-3.77-1.32-.5-1.28-1.23-1.62-1.23-1.62-1-.68.08-.67.08-.67 1.11.08 1.7 1.14 1.7 1.14.98 1.68 2.58 1.2 3.21.91.1-.71.39-1.2.71-1.47-2.48-.28-5.1-1.24-5.1-5.53 0-1.22.44-2.22 1.16-3.01-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.11 1.15a10.8 10.8 0 0 1 5.66 0c2.16-1.46 3.11-1.15 3.11-1.15.61 1.54.23 2.68.11 2.96.72.79 1.16 1.79 1.16 3.01 0 4.3-2.63 5.25-5.12 5.53.4.35.76 1.04.76 2.1 0 1.51-.01 2.73-.01 3.1 0 .3.2.65.77.54 4.44-1.48 7.64-5.66 7.64-10.6C23.02 5.24 18.27.5 12 .5Z" />
        </svg>
    );
}

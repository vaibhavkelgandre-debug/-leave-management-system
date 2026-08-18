// Owns its own open/close state so both ProfilePage's button and TopBar's
// dropdown can render the same modal without duplicating the Modal +
// ChangePasswordForm wiring.
import { useState } from "react";
import { Modal } from "../ui/Modal.jsx";
import { ChangePasswordForm } from "./ChangePasswordForm.jsx";

export function ChangePasswordModal({ trigger }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {trigger(() => setOpen(true))}
            <Modal open={open} onClose={() => setOpen(false)} title="Change password">
                <ChangePasswordForm />
            </Modal>
        </>
    );
}

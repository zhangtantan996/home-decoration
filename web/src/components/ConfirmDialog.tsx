import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  kicker?: string;
  amount?: string;
  description?: string;
  noticeTitle?: string;
  notice?: string;
  error?: string | null;
  confirmText: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  kicker = '支付确认',
  amount,
  description,
  noticeTitle,
  notice,
  error,
  confirmText,
  cancelText = '取消',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmDisabled) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmDisabled, onCancel, open]);

  if (!open) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="modal-backdrop"
      onClick={() => {
        if (!confirmDisabled) onCancel();
      }}
      role="presentation"
    >
      <div
        aria-describedby={description || notice ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-card confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="confirm-dialog-copy">
          <p className="confirm-dialog-kicker">{kicker}</p>
          <h2 id={titleId}>{title}</h2>
          {amount ? <div className="confirm-dialog-amount">{amount}</div> : null}
          {description ? <p className="confirm-dialog-description" id={descriptionId}>{description}</p> : null}
        </div>

        {notice ? (
          <div className="confirm-dialog-notice" id={description ? undefined : descriptionId}>
            {noticeTitle ? <h3>{noticeTitle}</h3> : null}
            <p>{notice}</p>
          </div>
        ) : null}

        {error ? <p className="confirm-dialog-error">{error}</p> : null}

        <div className="confirm-dialog-actions">
          <button className="button-outline" disabled={confirmDisabled} onClick={onCancel} type="button">
            {cancelText}
          </button>
          <button className="button-secondary" disabled={confirmDisabled} onClick={onConfirm} type="button">
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

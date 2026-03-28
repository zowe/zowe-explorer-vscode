interface SaveModalProps {
  isOpen: boolean;
}

export function SaveModal({ isOpen }: SaveModalProps) {
  if (!isOpen) return null;

  return <div className="save-modal-blocker" aria-hidden="true" />;
}

interface SaveModalProps {
  isOpen: boolean;
}

export function SaveModal({ isOpen }: SaveModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">Saving....</div>
    </div>
  );
}

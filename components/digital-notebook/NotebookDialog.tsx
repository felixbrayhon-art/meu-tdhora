import React, { useEffect, useRef } from 'react';

export default function NotebookDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="dn-dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <h3>{title}</h3>
    {children}
  </dialog>;
}

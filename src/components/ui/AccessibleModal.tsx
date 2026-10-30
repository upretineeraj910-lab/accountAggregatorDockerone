'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md'
}: AccessibleModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Click outside backdrop dismiss handler
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!isInside) {
      onClose();
    }
  };

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-heading-title"
      className={`p-0 w-full ${maxWidthClasses} bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm m-auto`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 id="modal-heading-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close modal dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </dialog>
  );
}

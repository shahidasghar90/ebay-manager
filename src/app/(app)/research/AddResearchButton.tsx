'use client';

import { useState } from 'react';
import ResearchForm from './ResearchForm';

export default function AddResearchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          + Add Research
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-3xl my-4">
            <ResearchForm onSaved={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

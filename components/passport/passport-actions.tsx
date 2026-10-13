"use client";

import { Printer } from "lucide-react";

export function PassportActions() {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => window.print()}
      title="Print this private report or save a PDF locally. You control who receives it."
    >
      <Printer className="size-4" />
      Print / save privately
    </button>
  );
}

"use client";

import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
  title?: string;
  testId?: string;
}

export function Button({ children, onClick, disabled, tone = "secondary", title, testId }: ButtonProps) {
  const tones = {
    primary: "bg-amber-500 text-stone-950 hover:bg-amber-400",
    secondary: "bg-stone-700 text-amber-50 hover:bg-stone-600",
    danger: "bg-red-700 text-white hover:bg-red-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      className={`rounded px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost";
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  solid: "bg-somnia-primary text-white shadow-soft hover:bg-somnia-primary/90",
  outline: "border border-white/40 text-white hover:bg-white/10",
  ghost: "text-white/80 hover:bg-white/5"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "solid", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-somnia-primary focus-visible:ring-offset-2 focus-visible:ring-offset-somnia-surface disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

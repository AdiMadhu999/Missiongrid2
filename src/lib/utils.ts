import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQuestionText(text: string): string {
  if (!text) return "";
  let formatted = text;

  // Rules from AGENTS.md
  formatted = formatted
    .replace(/\\triangle/g, "triangle")
    .replace(/\\sqrt\{([^}]+)\}/g, "√$1") 
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\pi/g, "π")
    .replace(/([a-zA-Z0-9])\^2/g, "$1²");

  formatted = formatted.replace(/\\text\{([^}]+)\}/g, "$1");

  formatted = formatted
    .replace(/\\/g, "")
    .replace(/\$/g, "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "");

  return formatted.replace(/\s+/g, " ").trim();
}

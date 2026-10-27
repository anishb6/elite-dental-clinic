/**
 * Reusable, accessible form primitives (label + control + error message).
 * Controls are uncontrolled so they work directly with `FormData`.
 */
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CONTROL_CLASS =
  "w-full border border-input bg-card px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive";

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string | undefined;
  /** Helper text shown under the control and linked to it via `aria-describedby`. */
  hint?: string;
  className?: string;
  children: (controlProps: {
    id: string;
    "aria-invalid": boolean;
    "aria-required"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
};

/** Label + control + inline error. The control is rendered via a render-prop so ids/ARIA stay wired up. */
export function Field({ label, required, error, hint, className, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("text-sm", className)}>
      <label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        ...(required ? { "aria-required": true as const } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {hint && (
        <p id={hintId} className="mt-1 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL_CLASS, className)} {...props} />;
}

export function TextAreaInput({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL_CLASS, className)} {...props} />;
}

type SelectInputProps = ComponentProps<"select"> & {
  options: readonly string[];
  placeholder: string;
  /** When true the placeholder can't be re-selected (required fields). */
  placeholderDisabled?: boolean;
};

export function SelectInput({
  options,
  placeholder,
  placeholderDisabled = false,
  className,
  ...props
}: SelectInputProps) {
  return (
    <select className={cn(CONTROL_CLASS, className)} defaultValue="" {...props}>
      <option value="" disabled={placeholderDisabled}>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

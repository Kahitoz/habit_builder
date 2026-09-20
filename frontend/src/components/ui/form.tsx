"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerRenderProps,
  type ControllerFieldState,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
  type UseFormStateReturn,
} from "react-hook-form";
import { cn } from "@/lib/utils";

/** RHF-friendly form primitives (shadcn-style, dependency-free). */

export function Form<TFieldValues extends FieldValues = FieldValues>(
  props: React.ComponentProps<typeof FormProvider<TFieldValues>>,
) {
  return <FormProvider {...props} />;
}

interface FormFieldContextValue {
  name: string;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

export interface FormFieldRenderProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  formState: UseFormStateReturn<TFieldValues>;
}

export interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: UseFormReturn<TFieldValues>["control"];
  name: TName;
  render: (props: FormFieldRenderProps<TFieldValues, TName>) => React.ReactElement;
}

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: FormFieldProps<TFieldValues, TName>) {
  const { control, name, render } = props;
  return (
    <FormFieldContext.Provider value={{ name: name as string }}>
      <Controller control={control} name={name} render={render} />
    </FormFieldContext.Provider>
  );
}

const FormItemContext = React.createContext<FormFieldContextValue | null>(null);

export function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(FormItemContext);
  if (!context) throw new Error("FormItem must be used within a FormField");
  return (
    <FormItemContext.Provider value={context}>
      <div className={cn("space-y-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export function FormControl({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function FormMessage({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const name = React.useContext(FormFieldContext)?.name;
  if (!name) return children ?? null;
  const { formState } = useFormContext();
  const error = formState.errors[name as keyof typeof formState.errors];
  const message =
    error && typeof error.message === "string" ? error.message : undefined;
  if (message) return <p className={cn("text-xs text-danger", className)}>{message}</p>;
  return children ?? null;
}

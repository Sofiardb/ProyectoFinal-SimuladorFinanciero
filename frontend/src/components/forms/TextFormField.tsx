import type { ComponentProps, ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface Props<TFieldValues extends FieldValues> {
  control:        Control<TFieldValues>
  name:           FieldPath<TFieldValues>
  label:          ReactNode
  itemClassName?: string
  labelClassName?: string
  inputProps?:    Omit<ComponentProps<typeof Input>, 'name'>
}

export default function TextFormField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  itemClassName,
  labelClassName,
  inputProps,
}: Props<TFieldValues>) {
  const InputComponent = inputProps?.type === 'password' ? PasswordInput : Input

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={itemClassName}>
          <FormLabel className={labelClassName}>{label}</FormLabel>
          <FormControl>
            <InputComponent {...inputProps} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

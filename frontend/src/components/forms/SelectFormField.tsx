import type { ComponentProps, ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface SelectFormFieldOption {
  value: string
  label: ReactNode
}

interface Props<TFieldValues extends FieldValues> {
  control:         Control<TFieldValues>
  name:            FieldPath<TFieldValues>
  label:           ReactNode
  options:         SelectFormFieldOption[]
  placeholder?:    string
  itemClassName?:  string
  labelClassName?: string
  disabled?:       boolean
  selectProps?:    Omit<ComponentProps<typeof Select>, 'value' | 'onValueChange' | 'disabled'>
  /** Se dispara además de field.onChange — útil para resetear otros campos cuando cambia la opción. */
  onValueChange?: (value: string) => void
}

/** Select controlado por react-hook-form, con el mismo FormItem/FormLabel/FormMessage que TextFormField. */
export default function SelectFormField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Elegir…',
  itemClassName,
  labelClassName,
  disabled,
  selectProps,
  onValueChange,
}: Props<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={itemClassName}>
          <FormLabel className={labelClassName}>{label}</FormLabel>
          <Select
            {...selectProps}
            items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
            disabled={disabled}
            value={field.value ? String(field.value) : undefined}
            onValueChange={(value) => {
              const v = String(value)
              field.onChange(v)
              onValueChange?.(v)
            }}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

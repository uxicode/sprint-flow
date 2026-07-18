import clsx from 'clsx';
import type { ChangeEventHandler, ReactNode } from 'react';

const GROUP_CLASS = {
  setting: 'setting-group',
  form: 'form-group',
  control: 'control-group',
} as const;

export interface FormFieldProps {
  variant?: keyof typeof GROUP_CLASS;
  as?: 'input' | 'select' | 'custom';
  id?: string;
  label: string;
  type?: string;
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  placeholder?: string;
  inputClassName?: string;
  groupClassName?: string;
  children?: ReactNode;
}

export default function FormField({
  variant = 'setting',
  as = 'input',
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  inputClassName,
  groupClassName,
  children,
  ...controlProps
}: FormFieldProps) {
  const defaultInputClass =
    variant === 'control'
      ? as === 'select'
        ? 'select-input'
        : 'control-input'
      : undefined;

  let control = null;

  if (as === 'select') {
    control = (
      <select
        id={id}
        value={value}
        onChange={onChange}
        className={clsx(defaultInputClass, inputClassName)}
        {...controlProps}
      >
        {children}
      </select>
    );
  } else if (as === 'input') {
    control = (
      <>
        <input
          type={type}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={clsx(defaultInputClass, inputClassName)}
          {...controlProps}
        />
        {children}
      </>
    );
  } else {
    control = children;
  }

  return (
    <div className={clsx(GROUP_CLASS[variant], groupClassName)}>
      <label htmlFor={id}>{label}</label>
      {control}
    </div>
  );
}

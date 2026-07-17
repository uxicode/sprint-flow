import type { ChangeEventHandler, KeyboardEventHandler, MouseEventHandler } from 'react';

export interface InputWithActionProps {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onKeyPress?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  actionLabel: string;
  onAction: MouseEventHandler<HTMLButtonElement>;
  actionClassName?: string;
}

export default function InputWithAction({
  id,
  label,
  value,
  onChange,
  onKeyPress,
  placeholder,
  actionLabel,
  onAction,
  actionClassName = 'btn btn-primary btn-sm',
}: InputWithActionProps) {
  return (
    <div className="setting-group">
      <label htmlFor={id}>{label}</label>
      <div className="input-with-action">
        <input
          type="text"
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyPress={onKeyPress}
        />
        <button type="button" onClick={onAction} className={actionClassName}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

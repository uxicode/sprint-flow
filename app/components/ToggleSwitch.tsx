import type { ChangeEventHandler } from 'react';

export interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  description?: string;
}

export default function ToggleSwitch({ id, label, checked, onChange, description }: ToggleSwitchProps) {
  return (
    <>
      <div className="mode-switch-container">
        <span className="mode-label">{label}</span>
        <label className="switch" id={`${id}-label`}>
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={onChange}
          />
          <span className="slider"></span>
        </label>
      </div>
      {description && <p className="mode-desc">{description}</p>}
    </>
  );
}

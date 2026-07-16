import clsx from 'clsx';

const GROUP_CLASS = {
  setting: 'setting-group',
  form: 'form-group',
  control: 'control-group',
};

/**
 * 폼 필드 컴포넌트
 * @param {string} variant - 변경
 * @param {string} as - 입력 타입
 * @param {string} id - 아이디
 * @param {string} label - 라벨
 * @param {string} type - 타입
 * @param {string} value - 값
 */
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
}) {
  const defaultInputClass = variant === 'control' ? 'select-input' : undefined;

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

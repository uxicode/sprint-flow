/**
 * 입력 필드와 액션 버튼 컴포넌트
 * @param {string} id - 아이디
 * @param {string} label - 라벨
 * @param {string} value - 값
 * @param {Function} onChange - 값 변경 핸들러
 * @param {Function} onKeyPress - 키 입력 핸들러
 * @param {string} placeholder - 입력 필드 플레이스홀더
 * @param {string} actionLabel - 액션 버튼 라벨
 * @param {Function} onAction - 액션 핸들러
 * @param {string} actionClassName - 액션 버튼 클래스
 */
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
}) {
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

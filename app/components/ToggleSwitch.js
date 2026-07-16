/**
 * 토글 스위치 컴포넌트
 * @param {string} id - 아이디
 * @param {string} label - 라벨
 * @param {boolean} checked - 체크 여부
 * @param {Function} onChange - 체크 변경 핸들러
 * @param {string} description - 설명
 */
export default function ToggleSwitch({ id, label, checked, onChange, description }) {
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

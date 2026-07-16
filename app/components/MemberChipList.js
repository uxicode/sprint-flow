import clsx from 'clsx';

/**
 * 멤버 칩 리스트 컴포넌트
 * @param {string[]} members - 멤버 목록
 * @param {string[]} activeMembers - 활성 멤버 목록
 * @param {Function} onToggle - 멤버 토글 핸들러
 */
export default function MemberChipList({ members, activeMembers, onToggle }) {
  return (
    <div className="member-chips-wrapper">
      {members.map((member, idx) => (
        <div
          key={idx}
          className={clsx('member-chip', activeMembers.includes(member) && 'active')}
          onClick={() => onToggle(member)}
        >
          {member}
        </div>
      ))}
    </div>
  );
}

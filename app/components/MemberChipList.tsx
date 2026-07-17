import clsx from 'clsx';

export interface MemberChipListProps {
  members: string[];
  activeMembers: string[];
  onToggle: (member: string) => void;
}

export default function MemberChipList({ members, activeMembers, onToggle }: MemberChipListProps) {
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

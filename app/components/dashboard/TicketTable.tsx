import StatusBadge from '../StatusBadge';
import type { Ticket } from '../../types';

export interface TicketTableProps {
  tickets: Ticket[];
}

export default function TicketTable({ tickets }: TicketTableProps) {
  return (
    <div className="ticket-list-wrapper">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>키</th>
            <th>요약</th>
            <th>상태</th>
            <th>담당자</th>
            <th>업데이트 날짜</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={5} className="table-empty-cell">
                조건에 맞는 티켓이 존재하지 않습니다.
              </td>
            </tr>
          ) : (
            tickets.map((ticket, idx) => (
              <tr key={idx}>
                <td><strong>{ticket.key}</strong></td>
                <td>{ticket.summary}</td>
                <td><StatusBadge status={ticket.status} /></td>
                <td>{ticket.assignee}</td>
                <td>{ticket.updated}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

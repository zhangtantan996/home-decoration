interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrevious = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="pagination">
      <div className="pagination-info">第 {page} / {totalPages} 页，共 {total} 条结果</div>
      <div className="inline-actions">
        <button className="button-ghost" disabled={!canPrevious} onClick={() => onChange(page - 1)} type="button">
          上一页
        </button>
        <button className="button-secondary" disabled={!canNext} onClick={() => onChange(page + 1)} type="button">
          下一页
        </button>
      </div>
    </div>
  );
}

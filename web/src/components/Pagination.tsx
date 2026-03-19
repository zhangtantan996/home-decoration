interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

function buildPageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    items.push('ellipsis');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push('ellipsis');
  }

  items.push(totalPages);
  return items;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrevious = page > 1;
  const canNext = page < totalPages;
  const pageItems = buildPageItems(page, totalPages);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <div className="pagination-info">第 {page} / {totalPages} 页，共 {total} 条结果</div>
      <div className="pagination-controls">
        <button className="button-ghost" disabled={!canPrevious} onClick={() => onChange(page - 1)} type="button">
          上一页
        </button>
        <div className="pagination-pages" aria-label="分页">
          {pageItems.map((item, index) => item === 'ellipsis' ? (
            <span className="pagination-ellipsis" key={`ellipsis-${index}`}>...</span>
          ) : (
            <button
              aria-current={item === page ? 'page' : undefined}
              className={`pagination-page ${item === page ? 'active' : ''}`}
              key={item}
              onClick={() => onChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button className="button-secondary" disabled={!canNext} onClick={() => onChange(page + 1)} type="button">
          下一页
        </button>
      </div>
    </div>
  );
}

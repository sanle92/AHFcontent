'use client';
export default function WorkspacePagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="cms-actions" aria-label="Result pages">
      <button
        className="btn outline small"
        disabled={page === 0}
        onClick={() => onPage(Math.max(0, page - 1))}
      >
        Previous 50
      </button>
      <span>
        {total ? Math.min(total, page * 50 + 1) : 0}–{Math.min(total, (page + 1) * 50)} of {total}
      </span>
      <button
        className="btn outline small"
        disabled={(page + 1) * 50 >= total}
        onClick={() => onPage(page + 1)}
      >
        Next 50
      </button>
    </div>
  );
}

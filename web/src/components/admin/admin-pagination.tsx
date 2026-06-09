import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type AdminPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

const siblingCount = 1

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const pages = visiblePages(currentPage, totalPages)

  function go(nextPage: number) {
    const bounded = Math.min(Math.max(1, nextPage), totalPages)
    if (bounded !== currentPage) onPageChange(bounded)
  }

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">共 {total} 条</span>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text="上一页"
              aria-disabled={currentPage <= 1}
              data-disabled={currentPage <= 1}
              className={
                currentPage <= 1 ? "pointer-events-none opacity-50" : undefined
              }
              onClick={(event) => {
                event.preventDefault()
                go(currentPage - 1)
              }}
            />
          </PaginationItem>
          {pages.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  href="#"
                  isActive={item === currentPage}
                  onClick={(event) => {
                    event.preventDefault()
                    go(item)
                  }}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              text="下一页"
              aria-disabled={currentPage >= totalPages}
              data-disabled={currentPage >= totalPages}
              className={
                currentPage >= totalPages
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault()
                go(currentPage + 1)
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function visiblePages(
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> {
  const boundarySize = 1
  const windowStart = Math.max(
    1 + boundarySize,
    currentPage - siblingCount
  )
  const windowEnd = Math.min(
    totalPages - boundarySize,
    currentPage + siblingCount
  )
  const pages: Array<number | "ellipsis"> = []

  for (let page = 1; page <= Math.min(boundarySize, totalPages); page += 1) {
    pages.push(page)
  }
  if (windowStart > boundarySize + 1) pages.push("ellipsis")
  for (let page = windowStart; page <= windowEnd; page += 1) {
    pages.push(page)
  }
  if (windowEnd < totalPages - boundarySize) pages.push("ellipsis")
  for (
    let page = Math.max(totalPages - boundarySize + 1, boundarySize + 1);
    page <= totalPages;
    page += 1
  ) {
    pages.push(page)
  }

  return pages
}

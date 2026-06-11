const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;

/**
 * Parses and sanitizes pagination + search + sort params from req.query.
 * Use this in every controller that needs pagination.
 *
 * @param {Object} query - req.query object
 * @returns {{ page: number, limit: number, offset: number, search: string, status: string, sortBy: string, sortOrder: string }}
 */
function getPagination(query) {
  try {
    let page = parseInt(query.page, 10) || DEFAULT_PAGE;
    let limit = parseInt(query.limit, 10) || DEFAULT_LIMIT;

    if (page < 1) page = DEFAULT_PAGE;
    if (limit < 1) limit = DEFAULT_LIMIT;

    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const offset = (page - 1) * limit;

    return {
      page,
      limit,
      offset,
      search:    (query.search || "").trim(),
      status:    (query.status || "").trim(),
      sortBy:    query.sortBy || "createdAt",
      sortOrder: query.sortOrder === "ASC" ? "ASC" : "DESC",
    };

  } catch (error) {

    return {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      offset: 0,
      search: "",
      status: "",
      sortBy: "createdAt",
      sortOrder: "DESC",
    };

  }
}

/**
 * Builds the pagination metadata block for API responses.
 *
 * @param {number} total - total matching records
 * @param {number} page - current page
 * @param {number} limit - page size
 * @returns {{ totalRecords: number, totalPages: number, currentPage: number, pageSize: number }}
 */
function buildPaginationMeta(total, page, limit) {

  const totalPages = Math.ceil(total / limit);

  return {
    totalRecords: total,
    totalPages,
    currentPage: page,
    pageSize: limit
  };
}

/**
 * Builds a standard paginated API response object.
 * Use this in every controller to keep the response shape consistent.
 *
 * @param {Array} data - page records
 * @param {Object} counts - global count stats (e.g. { total, pending, processed })
 * @param {number} total - total records matching (for pagination meta)
 * @param {number} page - current page
 * @param {number} limit - page size
 * @returns {Object} standardized response
 */
function buildPaginatedResponse(data, counts, total, page, limit) {
  return {
    success: true,
    data,
    pagination: buildPaginationMeta(total, page, limit),
    counts,
  };
}

module.exports = {
  getPagination,
  buildPaginationMeta,
  buildPaginatedResponse,
};
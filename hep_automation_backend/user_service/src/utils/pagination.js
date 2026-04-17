const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;

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
      offset
    };

  } catch (error) {

    return {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      offset: 0
    };

  }
}

function buildPaginationMeta(total, page, limit) {

  const totalPages = Math.ceil(total / limit);

  return {
    totalRecords: total,
    totalPages,
    currentPage: page,
    pageSize: limit
  };
}

module.exports = {
  getPagination,
  buildPaginationMeta
};
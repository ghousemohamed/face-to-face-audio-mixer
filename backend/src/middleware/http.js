export function cors(req, res, next) {
  res.set({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'content-type, range',
    'access-control-expose-headers': 'content-length, content-range, accept-ranges',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

export function handleError(logger) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) logger.error('[http]', error);
    res.status(status).json({ error: status === 500 ? 'internal_error' : 'invalid_request' });
  };
}

/**
 * Server-Sent Events, one stream per capture session.
 *
 * SSE rather than websockets because the traffic here is entirely one-way: the
 * pass application screen only ever listens. That keeps it plain HTTP — no
 * upgrade handshake for a proxy to mishandle, no client library to add to the
 * portal — and browsers reconnect on their own when a connection drops.
 *
 * Subscribers are held per session id, so a broadcast physically cannot reach
 * another applicant's screen: there is no shared channel to leak across.
 */
const subscribers = new Map();

/** How often to nudge the socket so idle proxies do not reap it. */
const HEARTBEAT_MS = 25000;

const add = (sessionId, res) => {
  if (!subscribers.has(sessionId)) subscribers.set(sessionId, new Set());
  subscribers.get(sessionId).add(res);
};

const remove = (sessionId, res) => {
  const set = subscribers.get(sessionId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(sessionId);
};

/**
 * Attaches an SSE stream for one session.
 *
 * `X-Accel-Buffering: no` matters in this deployment: nginx buffers proxied
 * responses by default, which holds events back until the buffer fills — the
 * photo would appear on the screen a minute late, or not until reload.
 */
const attach = (req, res, sessionId) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");

  add(sessionId, res);

  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    remove(sessionId, res);
  });
};

/** Sends the whole current state, never a delta. */
const publish = (sessionId, state) => {
  const set = subscribers.get(sessionId);
  if (!set) return;

  const payload = `event: session.state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // A dead socket is not worth a log line; 'close' will clean it up.
      remove(sessionId, res);
    }
  }
};

const subscriberCount = (sessionId) => subscribers.get(sessionId)?.size || 0;

module.exports = { attach, publish, subscriberCount };

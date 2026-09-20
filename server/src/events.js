// Live push for the portal and the admin sales view.
//
// The till posts receipts to POST /api/sales/sync. Every browser watching that
// business holds an SSE stream open here, so a closed table or a new receipt
// lands on screen on its own — nobody has to press Rifresko. The event carries
// no sale data: it only says "something changed", and the page refetches the
// same endpoints it already uses. That keeps authorisation in one place and
// means a missed event is harmless, because the poll fallback catches up.

const streams = new Map();

const HEARTBEAT_MS = 25000;
// A proxy or a laptop lid can leave dead sockets behind; without a cap one
// business could pin an unbounded number of them open.
const MAX_PER_BUSINESS = 24;

let nextId = 1;

function bucket(businessId) {
  let set = streams.get(businessId);
  if (!set) {
    set = new Map();
    streams.set(businessId, set);
  }
  return set;
}

function send(res, payload) {
  try {
    res.write(payload);
  } catch {
    // The socket died between the check and the write; the close handler
    // cleans it up.
  }
}

export function subscribe(businessId, req, res) {
  const set = bucket(businessId);
  if (set.size >= MAX_PER_BUSINESS) {
    // Drop the oldest rather than refusing the newest: the stale one is the
    // tab that was closed without the socket ever reporting it.
    const oldest = set.keys().next().value;
    const stale = set.get(oldest);
    set.delete(oldest);
    try {
      stale.end();
    } catch {
      /* already gone */
    }
  }

  // An idle SSE connection must not be timed out as a slow request.
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform also stops proxies from gzipping and therefore buffering.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx buffers a proxied response by default, which would hold events
    // back until the buffer fills. This turns buffering off for the stream.
    'X-Accel-Buffering': 'no'
  });

  const id = nextId++;
  set.set(id, res);

  // retry tells the browser how fast to reconnect after a drop; the default
  // is 3s in most engines, but being explicit keeps a restart of the API
  // cheap for the client.
  send(res, 'retry: 4000\n\n');
  send(res, `event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const stop = () => {
    const current = streams.get(businessId);
    if (!current) return;
    current.delete(id);
    if (current.size === 0) streams.delete(businessId);
  };

  req.on('close', stop);
  res.on('close', stop);
  res.on('error', stop);
}

export function publish(businessId, payload) {
  const set = streams.get(businessId);
  if (!set || set.size === 0) return;
  const frame = `event: sales\ndata: ${JSON.stringify({ at: Date.now(), ...payload })}\n\n`;
  for (const res of set.values()) send(res, frame);
}

// One timer for every stream: a comment line keeps proxies and load balancers
// from closing a connection that has had no traffic.
const heartbeat = setInterval(() => {
  for (const set of streams.values()) {
    for (const res of set.values()) send(res, ': ping\n\n');
  }
}, HEARTBEAT_MS);
heartbeat.unref();

#!/usr/bin/env node
import http from 'node:http';
import net from 'node:net';
import process from 'node:process';

const PORT = Number.parseInt(process.env.LOCAL_GATEWAY_PORT || '5175', 10);

const routes = [
  { prefix: '/admin', target: 'http://127.0.0.1:5173' },
  { prefix: '/merchant', target: 'http://127.0.0.1:5174' },
  { prefix: '/app', target: 'http://127.0.0.1:5176' },
];

function matchRoute(pathname = '/') {
  return routes.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) || null;
}

function pickHeaders(sourceHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(sourceHeaders)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }
    headers.set(key, value);
  }
  headers.set('host', `127.0.0.1:${PORT}`);
  headers.set('x-forwarded-host', `127.0.0.1:${PORT}`);
  headers.set('x-forwarded-proto', 'http');
  return headers;
}

const server = http.createServer(async (req, res) => {
  const route = matchRoute(req.url || '/');
  if (!route) {
    res.writeHead(302, { location: '/app/' });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || '/', route.target);
  const headers = pickHeaders(req.headers);
  const method = req.method || 'GET';

  try {
    const upstream = await fetch(requestUrl, {
      method,
      headers,
      redirect: 'manual',
      body: method === 'GET' || method === 'HEAD' ? undefined : req,
      duplex: method === 'GET' || method === 'HEAD' ? undefined : 'half',
    });

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') {
        return;
      }
      responseHeaders[key] = value;
    });

    res.writeHead(upstream.status, responseHeaders);

    if (!upstream.body) {
      res.end();
      return;
    }

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`local gateway error: ${error instanceof Error ? error.message : String(error)}`);
  }
});

server.on('upgrade', (req, socket, head) => {
  const route = matchRoute(req.url || '/');
  if (!route) {
    socket.destroy();
    return;
  }

  const upstreamUrl = new URL(req.url || '/', route.target);
  const upstreamPort = Number.parseInt(upstreamUrl.port || (upstreamUrl.protocol === 'https:' ? '443' : '80'), 10);
  const upstreamSocket = net.connect(upstreamPort, upstreamUrl.hostname, () => {
    const requestHeaders = Object.entries(req.headers)
      .flatMap(([key, value]) => {
        if (value === undefined) {
          return [];
        }
        if (Array.isArray(value)) {
          return value.map((item) => `${key}: ${item}`);
        }
        return `${key}: ${value}`;
      })
      .filter((line) => !/^host:/i.test(line));

    requestHeaders.push(`host: ${upstreamUrl.host}`);
    requestHeaders.push(`x-forwarded-host: 127.0.0.1:${PORT}`);
    requestHeaders.push('x-forwarded-proto: http');

    upstreamSocket.write(
      [
        `GET ${upstreamUrl.pathname}${upstreamUrl.search} HTTP/1.1`,
        ...requestHeaders,
        '',
        '',
      ].join('\r\n'),
    );

    if (head?.length) {
      upstreamSocket.write(head);
    }
  });

  const closeBoth = () => {
    if (!socket.destroyed) {
      socket.destroy();
    }
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  };

  upstreamSocket.on('error', closeBoth);
  socket.on('error', closeBoth);
  upstreamSocket.on('close', closeBoth);
  socket.on('close', closeBoth);

  upstreamSocket.on('data', (chunk) => {
    if (!socket.destroyed) {
      socket.write(chunk);
    }
  });

  socket.on('data', (chunk) => {
    if (!upstreamSocket.destroyed) {
      upstreamSocket.write(chunk);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`local gateway listening on http://127.0.0.1:${PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

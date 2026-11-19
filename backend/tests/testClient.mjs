// backend/tests/testClient.mjs
import http from 'node:http';
import { EventEmitter } from 'node:events';

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.remoteAddress = '127.0.0.1';
    this.remotePort = 50000;
  }
  destroy() {}
  resume() { return this; }
  pause() { return this; }
  write() { return true; }
}

class RequestBuilder {
  constructor(app, method, url) {
    this.app = app;
    this.method = method;
    this.url = url;
    this._headers = {};
    this._body = null;
  }

  set(field, val) {
    if (typeof field === 'object' && field !== null) {
      Object.assign(this._headers, field);
    } else if (typeof field === 'string') {
      this._headers[field] = val;
    }
    return this;
  }

  send(data) {
    this._body = data;
    return this;
  }

  then(resolve, reject) {
    return new Promise((res, rej) => {
      const socket = new MockSocket();
      const req = new http.IncomingMessage(socket);
      req.method = this.method.toUpperCase();
      req.url = this.url;
      req.headers = {};
      for (const [k, v] of Object.entries(this._headers)) {
        req.headers[k.toLowerCase()] = String(v);
      }

      if (this._body !== null && this._body !== undefined) {
        req.body = this._body;
        req._body = true;
        if (!req.headers['content-type']) {
          req.headers['content-type'] = 'application/json';
        }
      } else {
        req.body = {};
      }

      const resp = new http.ServerResponse(req);
      const chunks = [];

      resp.write = function (chunk, ...args) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return http.ServerResponse.prototype.write.call(this, chunk, ...args);
      };

      resp.end = function (chunk, ...args) {
        if (chunk && typeof chunk !== 'function') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const result = http.ServerResponse.prototype.end.call(this, chunk, ...args);

        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let parsedBody = rawBody;
        const contentType = resp.getHeader('content-type') || '';
        if (
          String(contentType).includes('json') ||
          rawBody.startsWith('{') ||
          rawBody.startsWith('[')
        ) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            // preserve raw
          }
        }

        res({
          status: resp.statusCode,
          statusCode: resp.statusCode,
          body: parsedBody,
          text: rawBody,
          headers: resp.getHeaders(),
        });

        return result;
      };

      try {
        this.app(req, resp, (err) => {
          if (err) rej(err);
        });
      } catch (err) {
        rej(err);
      }
    }).then(resolve, reject);
  }
}

export function createTestClient(app) {
  return {
    get: (url) => new RequestBuilder(app, 'GET', url),
    post: (url) => new RequestBuilder(app, 'POST', url),
    patch: (url) => new RequestBuilder(app, 'PATCH', url),
    put: (url) => new RequestBuilder(app, 'PUT', url),
    delete: (url) => new RequestBuilder(app, 'DELETE', url),
  };
}

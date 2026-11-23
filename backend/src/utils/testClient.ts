// backend/src/utils/testClient.ts
import http from 'node:http';
import { EventEmitter } from 'node:events';
import type { Express } from 'express';

class MockSocket extends EventEmitter {
  public remoteAddress = '127.0.0.1';
  public remotePort = 50000;
  destroy() { return this; }
  resume() { return this; }
  pause() { return this; }
  write() { return true; }
}

export interface TestResponse {
  status: number;
  statusCode: number;
  body: any;
  text: string;
  headers: Record<string, any>;
}

export class RequestBuilder {
  private _headers: Record<string, string> = {};
  private _body: any = null;

  constructor(
    private app: Express,
    private method: string,
    private url: string
  ) {}

  set(field: string | Record<string, string>, val?: string): this {
    if (typeof field === 'object' && field !== null) {
      for (const [k, v] of Object.entries(field)) {
        this._headers[k.toLowerCase()] = String(v);
      }
    } else if (typeof field === 'string' && val !== undefined) {
      this._headers[field.toLowerCase()] = String(val);
    }
    return this;
  }

  send(data: any): this {
    this._body = data;
    return this;
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    resolve?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return new Promise<TestResponse>((res, rej) => {
      const socket = new MockSocket() as unknown as import('node:net').Socket;
      const req = new http.IncomingMessage(socket);
      req.method = this.method.toUpperCase();
      req.url = this.url;
      req.headers = { ...this._headers };

      if (this._body !== null && this._body !== undefined) {
        (req as any).body = this._body;
        (req as any)._body = true;
        if (!req.headers['content-type']) {
          req.headers['content-type'] = 'application/json';
        }
      } else {
        (req as any).body = {};
      }

      const resp = new http.ServerResponse(req);
      const chunks: Buffer[] = [];

      resp.write = function (chunk: any, ...args: any[]): boolean {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return (http.ServerResponse.prototype.write as any).call(this, chunk, ...args);
      };

      resp.end = function (chunk?: any, ...args: any[]): any {
        if (chunk && typeof chunk !== 'function') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const result = (http.ServerResponse.prototype.end as any).call(this, chunk, ...args);

        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let parsedBody: any = rawBody;
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
        this.app(req as any, resp as any, (err: any) => {
          if (err) rej(err);
        });
      } catch (err) {
        rej(err);
      }
    }).then(resolve, reject);
  }
}

export function createTestClient(app: Express) {
  return {
    get: (url: string) => new RequestBuilder(app, 'GET', url),
    post: (url: string) => new RequestBuilder(app, 'POST', url),
    patch: (url: string) => new RequestBuilder(app, 'PATCH', url),
    put: (url: string) => new RequestBuilder(app, 'PUT', url),
    delete: (url: string) => new RequestBuilder(app, 'DELETE', url),
  };
}

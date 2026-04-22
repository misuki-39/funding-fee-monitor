import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as tlsConnect } from "node:tls";

const upstreamTimeoutMs = 8000;

function readProxyEnv() {
  return process.env.HTTPS_PROXY
    ?? process.env.https_proxy
    ?? process.env.ALL_PROXY
    ?? process.env.all_proxy
    ?? process.env.HTTP_PROXY
    ?? process.env.http_proxy
    ?? null;
}

function buildProxyAuthorizationHeader(proxyUrl: URL) {
  if (!proxyUrl.username && !proxyUrl.password) {
    return null;
  }

  const credentials = `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

async function requestTextDirect(url: URL) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(upstreamTimeoutMs)
  });

  return {
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? "application/json; charset=utf-8",
    body: await response.text()
  };
}

function requestTextViaHttpProxy(url: URL, proxyUrl: URL) {
  if (url.protocol !== "https:") {
    throw new Error(`Unsupported upstream protocol: ${url.protocol}`);
  }

  if (proxyUrl.protocol !== "http:") {
    throw new Error(`Unsupported proxy protocol: ${proxyUrl.protocol}`);
  }

  return new Promise<{ statusCode: number; contentType: string; body: string }>((resolve, reject) => {
    const upstreamPort = Number(url.port || 443);
    const proxyPort = Number(proxyUrl.port || 80);
    const proxyHeaders: Record<string, string> = {
      Host: `${url.hostname}:${upstreamPort}`
    };
    const proxyAuthorization = buildProxyAuthorizationHeader(proxyUrl);

    if (proxyAuthorization) {
      proxyHeaders["Proxy-Authorization"] = proxyAuthorization;
    }

    const connectRequest = httpRequest({
      host: proxyUrl.hostname,
      port: proxyPort,
      method: "CONNECT",
      path: `${url.hostname}:${upstreamPort}`,
      headers: proxyHeaders
    });

    connectRequest.setTimeout(upstreamTimeoutMs, () => {
      connectRequest.destroy(new Error(`Proxy CONNECT timed out after ${upstreamTimeoutMs}ms`));
    });

    connectRequest.on("connect", (connectResponse, socket) => {
      if (connectResponse.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed: status=${connectResponse.statusCode ?? "unknown"}`));
        return;
      }

      const tlsSocket = tlsConnect({
        socket,
        servername: url.hostname
      });

      tlsSocket.setTimeout(upstreamTimeoutMs, () => {
        tlsSocket.destroy(new Error(`Upstream request timed out after ${upstreamTimeoutMs}ms`));
      });

      const upstreamRequest = httpsRequest({
        host: url.hostname,
        port: upstreamPort,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Host: url.host
        },
        createConnection: () => tlsSocket
      }, (upstreamResponse) => {
        const chunks: string[] = [];

        upstreamResponse.setEncoding("utf8");
        upstreamResponse.on("data", (chunk) => {
          chunks.push(chunk as string);
        });
        upstreamResponse.on("end", () => {
          resolve({
            statusCode: upstreamResponse.statusCode ?? 502,
            contentType: upstreamResponse.headers["content-type"] ?? "application/json; charset=utf-8",
            body: chunks.join("")
          });
        });
      });

      upstreamRequest.setTimeout(upstreamTimeoutMs, () => {
        upstreamRequest.destroy(new Error(`Upstream request timed out after ${upstreamTimeoutMs}ms`));
      });

      upstreamRequest.on("error", reject);
      upstreamRequest.end();
    });

    connectRequest.on("error", reject);
    connectRequest.end();
  });
}

async function requestText(url: URL) {
  const proxyValue = readProxyEnv();

  if (!proxyValue) {
    return requestTextDirect(url);
  }

  return requestTextViaHttpProxy(url, new URL(proxyValue));
}

export async function fetchUpstreamJson<T>(url: string, errorLabel: string): Promise<T> {
  const upstream = await requestText(new URL(url));

  if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
    throw new Error(`HTTP ${upstream.statusCode} from ${errorLabel}`);
  }

  try {
    return JSON.parse(upstream.body) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON from ${errorLabel}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

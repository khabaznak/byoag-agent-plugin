import { ByoagError } from "./errors.js";
import type { HttpRequest, HttpTransport } from "./types.js";
import { DomainPolicy } from "./domain.js";

const MAX_RESPONSE_BYTES = 1_048_576;

export class SecureJsonHttpTransport implements HttpTransport {
  constructor(
    private readonly domainPolicy: DomainPolicy,
    private readonly timeoutMs = 10_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async requestJson(url: URL, request: HttpRequest = {}): Promise<unknown> {
    await this.domainPolicy.assertPublicDestination(url);
    const headers = new Headers({ Accept: "application/json", "User-Agent": "byoag-connector/0.1.0" });
    if (request.body !== undefined) headers.set("Content-Type", "application/json");
    if (request.bearerToken) headers.set("Authorization", `Bearer ${request.bearerToken}`);

    let response: Response;
    try {
      const init: RequestInit = {
        method: request.method ?? "GET",
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      };
      if (request.body !== undefined) init.body = JSON.stringify(request.body);
      response = await this.fetchImpl(url, init);
    } catch {
      throw new ByoagError("network_error", "The platform could not be reached.", true);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new ByoagError("platform_error", "Cross-origin and implicit redirects are not accepted.");
    }
    if (response.status === 404) throw new ByoagError("discovery_not_found", "The BYOAg endpoint was not found.");
    if (!response.ok) throw new ByoagError("platform_error", `The platform rejected the request with HTTP ${response.status}.`, response.status >= 500);

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw new ByoagError("platform_error", "The platform response is too large.");
    if (response.status === 204) return {};
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("+json")) {
      throw new ByoagError("platform_error", "The platform response is not JSON.");
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new ByoagError("platform_error", "The platform response is too large.");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ByoagError("platform_error", "The platform returned invalid JSON.");
    }
  }
}

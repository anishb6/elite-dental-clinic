import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "./parse-body";

const testSchema = z.object({
  name: z.string(),
  count: z.number().optional(),
});

function createRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("parseJsonBody", () => {
  it("parses valid JSON matching schema", async () => {
    const req = createRequest(JSON.stringify({ name: "Dr. Debayan" }));
    const result = await parseJsonBody(req, testSchema);
    expect(result).toEqual({ name: "Dr. Debayan" });
  });

  it("rejects malformed JSON with status 400", async () => {
    const req = createRequest("{ not valid json");
    await expect(parseJsonBody(req, testSchema)).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
      userMessage: "Invalid request.",
    });
  });

  it("rejects payload failing schema validation with status 400", async () => {
    const req = createRequest(JSON.stringify({ name: 123 }));
    await expect(parseJsonBody(req, testSchema)).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
  });

  it("rejects oversized request body (content-length > 64 KiB) with status 413", async () => {
    const req = createRequest(JSON.stringify({ name: "a" }), {
      "Content-Length": "70000",
    });
    await expect(parseJsonBody(req, testSchema)).rejects.toMatchObject({
      code: "VALIDATION",
      status: 413,
      userMessage: "Request too large.",
    });
  });

  it("rejects oversized text body without content-length with status 413", async () => {
    const largeName = "x".repeat(70_000);
    const req = createRequest(JSON.stringify({ name: largeName }));
    await expect(parseJsonBody(req, testSchema)).rejects.toMatchObject({
      code: "VALIDATION",
      status: 413,
    });
  });

  it("rejects unsupported content-type (e.g. application/xml) with status 415", async () => {
    const req = createRequest("<xml></xml>", {
      "Content-Type": "application/xml",
    });
    await expect(parseJsonBody(req, testSchema)).rejects.toMatchObject({
      code: "VALIDATION",
      status: 415,
      userMessage: "Content-Type must be application/json.",
    });
  });
});

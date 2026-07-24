import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: authMock,
}));

const handleUploadMock = vi.fn(
  async ({
    onBeforeGenerateToken,
  }: {
    onBeforeGenerateToken: (
      pathname: string,
    ) => Promise<Record<string, unknown>>;
  }) => {
    const tokenOptions = await onBeforeGenerateToken("test.png");
    return {
      type: "blob.generate-client-token",
      clientToken: "fake-token",
      ...tokenOptions,
    };
  },
);
vi.mock("@vercel/blob/client", () => ({
  handleUpload: handleUploadMock,
}));

const { POST } = await import("./route");

function buildRequest() {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token" }),
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    authMock.mockReset();
    handleUploadMock.mockClear();
  });

  it("returns 400 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("authorizes the upload with content-type and size restrictions when there is a session", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", organizerId: "org-1", role: "ORGANIZER_ADMIN" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allowedContentTypes).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(body.maximumSizeInBytes).toBe(5 * 1024 * 1024);
  });
});

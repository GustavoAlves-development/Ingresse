import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: authMock,
}));

const putMock = vi.fn(
  async (pathname: string, _body: File, _options: Record<string, unknown>) => ({
    url: `https://example-blob.vercel-storage.com/${pathname}`,
  }),
);
vi.mock("@vercel/blob", () => ({
  put: putMock,
}));

const { POST } = await import("./route");

function buildRequest(file?: File) {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    authMock.mockReset();
    putMock.mockClear();
  });

  it("returns 400 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const file = new File(["fake"], "test.png", { type: "image/png" });
    const response = await POST(buildRequest(file));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 400 when there is no file", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", organizerId: "org-1", role: "ORGANIZER_ADMIN" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when the content type is not allowed", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", organizerId: "org-1", role: "ORGANIZER_ADMIN" },
    });

    const file = new File(["fake"], "test.gif", { type: "image/gif" });
    const response = await POST(buildRequest(file));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(putMock).not.toHaveBeenCalled();
  });

  it("uploads the file and returns its url when there is a session", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", organizerId: "org-1", role: "ORGANIZER_ADMIN" },
    });

    const file = new File(["fake"], "test.png", { type: "image/png" });
    const response = await POST(buildRequest(file));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://example-blob.vercel-storage.com/test.png");
    expect(putMock).toHaveBeenCalledTimes(1);
    const [pathname, uploadedFile, options] = putMock.mock.calls[0];
    expect(pathname).toBe("test.png");
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe(file.name);
    expect((uploadedFile as File).type).toBe(file.type);
    expect(options).toEqual(
      expect.objectContaining({ access: "public", contentType: "image/png" }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { uploadPdf, UPLOAD_URL } from "./uploadPdf";

const file = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
const okFetch = () => vi.fn().mockResolvedValue({ ok: true, status: 200 });

describe("uploadPdf", () => {
  it("posts the file as 'pdf' form data to the upload URL", async () => {
    const fetchFn = okFetch();
    await uploadPdf(file, async () => null, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(UPLOAD_URL);
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("pdf")).toBe(file);
  });

  it("sends a Bearer token when available", async () => {
    const fetchFn = okFetch();
    await uploadPdf(file, async () => "tok", fetchFn);
    expect(fetchFn.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer tok" });
  });

  it("sends no auth header without a token", async () => {
    const fetchFn = okFetch();
    await uploadPdf(file, async () => null, fetchFn);
    expect(fetchFn.mock.calls[0][1].headers).toBeUndefined();
  });

  it("rejects on a non-ok response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(uploadPdf(file, async () => null, fetchFn)).rejects.toThrow("500");
  });

  it("rejects when the network fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(uploadPdf(file, async () => null, fetchFn)).rejects.toThrow("down");
  });
});

import { API_URL } from "./api";

export const UPLOAD_URL = `${API_URL}/upload/pdf`;

export async function uploadPdf(
  file: File,
  getToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const formData = new FormData();
  formData.append("pdf", file);
  const token = await getToken();
  const res = await fetchFn(UPLOAD_URL, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

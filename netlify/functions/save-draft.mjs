import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const data = await request.json();

    const title = (data.title || "").trim();
    const issueDate = (data.issueDate || "").trim();
    const edition = (data.edition || "").trim();

    if (!title) {
      return new Response(
        JSON.stringify({ ok: false, error: "Title is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const store = getStore("drafts");
    const key = `${edition || "general"}-${Date.now()}`;

    const draft = {
      id: key,
      title,
      issueDate,
      edition,
      content: data.content || {},
      notes: data.notes || "",
      savedAt: new Date().toISOString()
    };

    await store.setJSON(key, draft);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Draft saved",
        id: key,
        draft
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

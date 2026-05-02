import { getStore } from "@netlify/blobs";

export default async () => {
  try {
    const store = getStore("drafts");
    const { blobs } = await store.list();

    const drafts = [];

    for (const blob of blobs) {
      const draft = await store.get(blob.key, { type: "json" });
      if (draft) drafts.push(draft);
    }

    drafts.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    return new Response(
      JSON.stringify({
        ok: true,
        drafts
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Could not load drafts"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
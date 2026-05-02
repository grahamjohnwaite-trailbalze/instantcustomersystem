import { getStore } from '@netlify/blobs';

export const handler = async () => {
  try {
    const store = getStore({ name: 'newsletter-drafts' });
    const { blobs } = await store.list();

    const drafts = [];
    for (const blob of blobs) {
      const item = await store.get(blob.key, { type: 'json' });
      if (item) drafts.push(item);
    }

    drafts.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, drafts })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
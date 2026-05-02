import { getStore } from '@netlify/blobs';
import { randomUUID } from 'crypto';

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Method not allowed' })
      };
    }

    const data = JSON.parse(event.body || '{}');
    const store = getStore({ name: 'newsletter-drafts' });

    const id = data.id && String(data.id).trim()
      ? String(data.id).trim()
      : `draft_${randomUUID()}`;

    const draft = {
      ...data,
      id,
      savedAt: new Date().toISOString()
    };

    await store.setJSON(id, draft);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, draft })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
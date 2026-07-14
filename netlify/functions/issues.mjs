import { TABLES, cleanRecord, json, listAll, publicError } from './_airtable.mjs';

export default async (request) => {
  try {
    const url = new URL(request.url);
    const publicationId = url.searchParams.get('publicationId');
    const records = (await listAll(TABLES.issues))
      .map(cleanRecord)
      .filter(({ fields }) => !publicationId || (fields.Publication || []).includes(publicationId))
      .sort((a, b) => {
        const ad = a.fields['Send Date'] || '';
        const bd = b.fields['Send Date'] || '';
        return bd.localeCompare(ad) || Number(b.fields['Issue Number'] || 0) - Number(a.fields['Issue Number'] || 0);
      });
    return json(200, { ok: true, records, count: records.length });
  } catch (error) {
    return publicError(error, 'issues');
  }
};

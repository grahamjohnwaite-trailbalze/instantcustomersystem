import { TABLES, cleanRecord, json, listAll, publicError } from './_airtable.mjs';

export default async () => {
  try {
    const records = await listAll(TABLES.publications);
    const active = records
      .map(cleanRecord)
      .filter(({ fields }) => !['Archived', 'Inactive'].includes(fields.Status))
      .sort((a, b) => String(a.fields['Publication Name'] || '').localeCompare(String(b.fields['Publication Name'] || '')));
    return json(200, { ok: true, records: active, count: active.length });
  } catch (error) {
    return publicError(error, 'publications');
  }
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed"
      })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const title = (data.title || "").trim();
    const issueDate = (data.issueDate || "").trim();
    const edition = (data.edition || "").trim();
    const content = data.content || "";
    const notes = data.notes || "";

    if (!title) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Title is required"
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        message: "Draft received",
        draft: {
          title,
          issueDate,
          edition,
          content,
          notes
        },
        savedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Invalid request"
      })
    };
  }
}
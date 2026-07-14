export default async (request, context) => {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "Hello from Netlify Functions",
      time: new Date().toISOString()
    }),
    {
      headers: { "content-type": "application/json" }
    }
  );
};
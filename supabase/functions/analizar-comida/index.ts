import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const mealPrompt = `Eres un personaje virtual de nutrición firme, exigente y divertido. Ajusta el tono según el nivel de exigencia indicado en el contexto del usuario, sin insultos ni afirmaciones médicas.
Analiza la imagen de la comida y el contexto del usuario. Devuelve estrictamente un objeto JSON válido con esta estructura exacta (sin markdown extra):
{
  "calorias": número estimado,
  "proteinas": número estimado en gramos,
  "nombreComida": "nombre detectado",
  "comentarioEstricto": "Un comentario de tu personaje juzgando la comida o felicitando con tono duro pero divertido"
}`;

const bodyPrompt = `Analiza una foto corporal únicamente como referencia visual de progreso fitness. Usa los datos de edad, peso, altura, actividad, objetivos, detalles adicionales y las calorías/proteínas base calculadas que vienen en la descripción para proponer recomendaciones prácticas. No diagnostiques enfermedades, no afirmes un porcentaje exacto de grasa corporal y no deduzcas salud, personalidad, somatotipo ni condiciones médicas. Las recomendaciones deben ser coherentes con los datos proporcionados y no deben depender de una supuesta medición exacta de la foto. Si la imagen no permite observar algo, dilo.
Devuelve únicamente JSON válido con esta estructura:
{
  "nivelMuscularVisual": "bajo | moderado | alto | no evaluable",
  "composicionVisual": "descripción neutral y breve, sin porcentaje exacto",
  "posturaObservada": "observación descriptiva o no evaluable",
  "confianza": "baja | media | alta",
  "recomendacionCalorias": 2000,
  "recomendacionProteinas": 150,
  "mantenimientoCalorias": 2200,
  "nivelExigencia": "firme | intenso | muy intenso",
  "veredictoInicial": "comentario breve, firme y motivador, sin insultos ni diagnóstico",
  "limitaciones": "aviso de que una foto no es una medición médica"
}`;

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const { imageBase64, descripcion, mimeType, tipo } = await req.json();
      const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

      if (!openAiApiKey) {
        throw new Error("Falta configurar OPENAI_API_KEY en los secretos de Supabase");
      }

      const isBodyAnalysis = tipo === "cuerpo";
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${isBodyAnalysis ? bodyPrompt : mealPrompt}\nDescripción del usuario: ${descripcion || "Sin descripción"}`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 300,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || `OpenAI respondió con ${response.status}`);
      }

      const contenido = data?.choices?.[0]?.message?.content;
      if (!contenido) {
        throw new Error("OpenAI no devolvió un análisis válido");
      }

      const result = JSON.parse(
        String(contenido).replace(/```json/g, "").replace(/```/g, "").trim(),
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido al analizar la comida";
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

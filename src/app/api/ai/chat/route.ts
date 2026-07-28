import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  projects,
  outlineNodes,
  knowledgeFiles,
  aiMessages,
} from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getAnthropic,
  SYSTEM_BASE,
  MODELO_POR_TAREA,
  bloquesSistemaConCache,
} from "@/lib/anthropic";
import { modeloId, registrarUso, usoDeRespuesta } from "@/lib/ai-usage";
import {
  TOOLS,
  executeTool,
  renderOutlineProgress,
  renderOutlineWithIds,
  type ToolCtx,
} from "@/lib/ai-tools";
import { consumirCuota } from "@/lib/quotas";
import type Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOOL_LOOPS = 6;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    projectId: string;
    nodeId?: string | null;
    scope?: "section" | "global";
    message: string;
  };
  const scope: "section" | "global" =
    body.scope === "section" || body.scope === "global"
      ? body.scope
      : body.nodeId
        ? "section"
        : "global";

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!projectRows.length) {
    return new Response("Project not found", { status: 404 });
  }
  const project = projectRows[0];
  const ctx: ToolCtx = {
    projectId: project.id,
    userId: user.id,
    isBook: project.type === "book",
    project,
  };

  // ── CUOTA ─────────────────────────────────────────────────────────────────
  // Después de validar la propiedad del proyecto (una petición a un proyecto
  // ajeno no debe gastarle cuota a nadie) y ANTES de guardar el mensaje del
  // usuario y de abrir el stream. Dos razones para que sea aquí y no dentro
  // del ReadableStream:
  //   1. Una vez abierto el stream la respuesta ya salió con 200 y no se puede
  //      cambiar el código de estado; el 402 tiene que viajar como respuesta
  //      normal, con la misma forma que las demás rutas de IA.
  //   2. Si guardáramos el mensaje del usuario antes de rechazarlo, ese texto
  //      quedaría en el historial y contaminaría el contexto de los turnos
  //      siguientes con una pregunta que la IA nunca vio.
  const cuota = await consumirCuota(user.id, "chat");
  if (!cuota.ok) {
    // 402 Payment Required: el usuario está autorizado, lo que se acabó es su
    // cuota. 403 diría "no eres tú", y no es eso.
    return NextResponse.json(
      {
        error: cuota.mensaje,
        limite: cuota.limite,
        usado: cuota.usado,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  // Save user message immediately.
  await db.insert(aiMessages).values({
    id: nanoid(),
    projectId: project.id,
    nodeId: body.nodeId ?? null,
    role: "user",
    content: body.message,
  });

  // Recent history (text-only — tool calls are not replayed)
  const history = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.projectId, project.id))
    .orderBy(asc(aiMessages.createdAt));
  const priorHistory = history.slice(0, -1).slice(-10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let assistantText = "";
      let outlineChanged = false;
      let streamFailed = false;

      try {
        // Temario SIN progreso: es lo que entra al bloque cacheado. Ver el
        // bloque de PROMPT CACHING más abajo para el porqué de la separación.
        let outlineText = await renderOutlineWithIds(project.id, {
          conProgreso: false,
        });
        // Progreso (estado + palabras por nodo): va al bloque volátil.
        let outlineProgreso = await renderOutlineProgress(project.id);
      let totalToolUsesThisTurn = 0;
      // Heurística: ¿el usuario está pidiendo INSERTAR contenido en esta vuelta?
      const userMsgLower = body.message.toLowerCase();
      const userWordCount = body.message
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      const userAskedToStore =
        userWordCount > 60 ||
        /\b(agrega|agreguen|agregalo|insert(a|alo|alos)?|guarda(lo|los)?|p[oó]n(ga|lo|el|esta)?|mete(la|lo|esta)?|d[ée]jame esto|busca d[oó]nde|busca donde|escribe esto|anota esto|esta historia|esta idea va|incluye esto|comp[aá]rte la|toma esto)\b/i.test(
          userMsgLower
        );
      // Frases que tradicionalmente significan "ya lo hice" en español.
      const claimsToHaveDone = (text: string) =>
        /\b(lo agregu[ée]|listo[,.\s]|ya qued[óo]|ya est[áa]|guardad[oa]|lo guard[ée]|lo dej[ée] en|lo ins?ert[ée]|lo puse en|lo a[ñn]ad[íi]|sugerencia dejada|apertura cargada|ya la a[ñn]ad[íi]|ya la met[íi]|historia agregad[ao]|historia metida)\b/i.test(
          text
        );
        const kb = await db
          .select()
          .from(knowledgeFiles)
          .where(eq(knowledgeFiles.projectId, project.id));
        const kbContext = kb.length
          ? kb
              .map(
                (k) =>
                  `[KB:${k.name}] ${k.summary ?? k.extractedText.slice(0, 600)}`
              )
              .join("\n\n")
              .slice(0, 8000)
          : "";

        let activeSection = "";
        let scopeInstruction = "";
        if (body.nodeId && scope === "section") {
          const node = await db
            .select()
            .from(outlineNodes)
            .where(eq(outlineNodes.id, body.nodeId))
            .limit(1);
          if (node[0]) {
            activeSection = `\n\nEstás trabajando en este momento en: id=${node[0].id} "${node[0].title}" (${node[0].kind}).
${node[0].summary ? `Resumen: ${node[0].summary}\n` : ""}Contenido actual (${node[0].wordCount} palabras):
${(node[0].content || "(vacío)").replace(/<[^>]*>/g, " ").slice(0, 4000)}`;
            scopeInstruction = `

ALCANCE ACTUAL DEL CHAT: "Esta sección" — el usuario eligió que trabajemos SOLO en "${node[0].title}" (id=${node[0].id}).

Reglas para este alcance:
- Toda acción que ejecutes con tools debe afectar esta sección o sus hijos directos.
- Si el usuario te pide algo que claramente afecta OTRAS secciones, capítulos, el outline completo, el título del libro, o la configuración del proyecto:
  1. NO ejecutes la herramienta inmediatamente.
  2. Responde explicando que esa acción es de alcance global y afecta más allá de esta sección.
  3. Pregúntale si quiere que cambie el alcance a "Todo el proyecto" para proceder, o si prefiere reformular.
  4. Solo después de su confirmación explícita, ejecuta las herramientas.
- Acciones consideradas globales: regenerar outline, agregar/eliminar/renombrar capítulos enteros, mover capítulos, editar otra sección distinta, cambiar settings del proyecto.
- Acciones de alcance local OK: append_to_section/replace_section_content sobre la sección actual, insert_decoration en la sección actual, update_node_summary o rename_node SOBRE la sección actual.`;
          }
        } else {
          scopeInstruction = `

ALCANCE ACTUAL DEL CHAT: "Todo el proyecto" — puedes editar cualquier capítulo, sección, módulo, lección o el outline completo según lo que pida el usuario. Aún así pregunta antes de eliminar capítulos enteros.`;
        }

        // ═══════════════════════════════════════════════════════════════
        // PROMPT CACHING — el ahorro grande y sin costo de calidad
        // ═══════════════════════════════════════════════════════════════
        // Medido en producción: 1 mensaje de chat = 21,552 tokens de entrada,
        // de los cuales ~18,000 son este prefijo estable. Cachearlo lo cobra a
        // 0.1x en cada request siguiente de la misma conversación.
        //
        // ESTABLE (antes del breakpoint): SYSTEM_BASE + ficha del proyecto +
        // reglas de tools + regla anti-alucinación + ESTRUCTURA del temario
        // (kind, id, título, resumen) + contexto de la base de conocimiento.
        // Nada de esto cambia entre requests de la misma conversación — la
        // estructura solo cambia si una tool la modifica, y en ese caso la
        // invalidación es correcta y deseada (el modelo debe ver el temario
        // nuevo).
        //
        // ⚠️ EL PROGRESO NO PUEDE IR AQUÍ. El render con progreso mete por
        // cada nodo `(status, wordCount p)`, y wordCount sube con cada
        // guardado del editor: el autor escribe media línea, cambia un byte
        // del prefijo y la caché se invalida ENTERA. Antes de este arreglo el
        // temario con progreso vivía dentro del bloque marcado, así que el
        // ahorro real de caché entre mensajes de una misma conversación era
        // CERO — solo se pagaba el premium de escritura (1.25x) una y otra
        // vez. Por eso el temario cacheado se pide con `conProgreso: false` y
        // el avance viaja abajo.
        //
        // VOLÁTIL (después del breakpoint, sin marca): la sección activa (su
        // contenido cambia mientras el autor escribe), la instrucción de
        // alcance y el AVANCE por nodo. El historial y el mensaje del usuario
        // viven en `messages`, que la API renderiza DESPUÉS de `system`, así
        // que ya quedan fuera del prefijo cacheado por construcción.
        //
        // NO reordenar: cualquier byte movido antes del breakpoint invalida
        // toda la caché.
        const buildEstable = (currentOutline: string) => `${SYSTEM_BASE}

Proyecto actual:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.description ? `- Descripción: ${project.description}` : ""}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.styleNotes ? `- Notas de estilo: ${project.styleNotes}` : ""}
${project.glossary ? `- Glosario obligatorio: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}

IMPORTANTE: Cuando el usuario te pida modificar el outline o el contenido (renombrar, agregar, eliminar, reordenar capítulos/secciones; añadir contenido a una sección), USA LAS HERRAMIENTAS DISPONIBLES (rename_node, add_node, delete_node, move_node, update_node_summary, append_to_section, replace_section_content, leave_suggestion, insert_decoration). NO solo describas los cambios — EJECÚTALOS. Después de ejecutar las herramientas, confirma brevemente al usuario lo que hiciste.

═══════════════════════════════════════════════════
REGLA ANTI-ALUCINACIÓN — CRÍTICA
═══════════════════════════════════════════════════
NUNCA digas que ejecutaste una acción si no llamaste la herramienta correspondiente. Esto incluye frases como:
- "Lo agregué a la sección X"
- "Listo, ya quedó guardado en X"
- "Lo guardé en X"
- "Lo dejé en X"
- "Apertura cargada"
- "Sugerencia dejada en X"

Cada una de esas frases requiere una herramienta REAL ejecutada en este mismo turno. Si por algún motivo no puedes o no debes ejecutar la herramienta (alcance incorrecto, falta de claridad, sin permisos, error técnico), debes decirlo explícitamente: "No ejecuté la acción porque..." y proponer cómo proceder.

Cuando el usuario te dé contenido (una historia, una idea, un párrafo, un dato) y te pida que lo guardes/insertes/agregues:
1. Identifica la sección correcta (puedes preguntar si hay duda).
2. Llama append_to_section con ese contenido convertido a HTML simple. NO inventes palabras ni reformules salvo limpieza mínima de puntuación. RESPETA el texto del usuario.
3. SOLO después de que la herramienta retorne ok:true, confirma al usuario diciendo dónde quedó.
4. Si la herramienta falla, dilo y NO finjas que funcionó.

Si tu memoria de la conversación dice que "ya guardaste algo" pero no encuentras esa acción en el outline o el log, ASUME que NO se guardó y vuelve a ejecutar la herramienta. La memoria del chat puede estar desincronizada con el estado real — la fuente de verdad son las herramientas y el outline que tienes abajo.

Reglas para tools:
- Para conocer los IDs de los nodos consulta el outline abajo.
- NUNCA elimines un nodo a menos que el usuario lo haya pedido explícitamente.
- replace_section_content: SOLO si el usuario dijo "reemplaza" o "rescribe esto". Si no, usa append_to_section.
- append_to_section: máximo 1-3 párrafos por turno. Tu trabajo es organizar, no escribir capítulos enteros.

Outline actual (con IDs). El AVANCE de cada nodo (estado y palabras escritas) NO va aquí: viene más abajo, en el bloque "Avance actual del temario".
${currentOutline}
${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}`;

        const buildVolatil = (progreso: string) => `${activeSection}${scopeInstruction}

Avance actual del temario (mismos IDs de arriba; formato: estado, palabras escritas):
${progreso}`;

        const buildSystem = (currentOutline: string, progreso: string) =>
          bloquesSistemaConCache({
            estable: buildEstable(currentOutline),
            volatil: buildVolatil(progreso),
          });

        const modeloTarea = MODELO_POR_TAREA.chat;
        const anthropic = getAnthropic();
        const messages: Anthropic.Messages.MessageParam[] = [
          ...priorHistory.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: body.message },
        ];

        let loop = 0;
        while (loop < MAX_TOOL_LOOPS) {
          loop++;
          const response = await anthropic.messages.create({
            model: modeloId(modeloTarea),
            max_tokens: 4096,
            system: buildSystem(outlineText, outlineProgreso),
            tools: TOOLS,
            messages,
          });

          // Se mide CADA vuelta del loop de tools, no solo la última: un turno
          // con 3 tool_use son 4 llamadas a la API y las 4 se pagan.
          const uso = usoDeRespuesta(response.usage);
          await registrarUso({
            userId: user.id,
            projectId: project.id,
            accion: "chat",
            modelo: modeloTarea,
            inputTokens: uso.input,
            outputTokens: uso.output,
            cacheReadTokens: uso.cacheRead,
            cacheWriteTokens: uso.cacheWrite,
          });

          const blocks = response.content;
          for (const block of blocks) {
            if (block.type === "text") {
              assistantText += (assistantText ? "\n" : "") + block.text;
              send({ type: "delta", text: block.text });
            }
          }

          const toolUses = blocks.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
          );
          totalToolUsesThisTurn += toolUses.length;

          if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
            break;
          }

          // Execute tool uses, send progress, build tool_result blocks.
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send({
              type: "tool",
              name: tu.name,
              input: tu.input,
              status: "running",
            });
            const result = await executeTool(
              tu.name,
              (tu.input ?? {}) as Record<string, unknown>,
              ctx
            );
            send({
              type: "tool",
              name: tu.name,
              status: result.ok ? "ok" : "error",
              error: result.ok ? undefined : result.error,
            });
            if (result.ok) outlineChanged = true;
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              is_error: !result.ok,
              content: result.ok
                ? JSON.stringify(result.data ?? { ok: true })
                : (result.error ?? "error"),
            });
          }

          messages.push({ role: "assistant", content: blocks });
          messages.push({ role: "user", content: toolResults });

          if (outlineChanged) {
            outlineText = await renderOutlineWithIds(project.id, {
              conProgreso: false,
            });
            outlineProgreso = await renderOutlineProgress(project.id);
          }
        }

        // ═══════════════════════════════════════════════════════════════
        // GUARDRAIL ANTI-ALUCINACIÓN
        // ═══════════════════════════════════════════════════════════════
        // Si el usuario claramente pidió guardar contenido (mucho texto o
        // verbos de inserción) Y la respuesta DICE haber hecho algo pero
        // NO se ejecutó NINGUNA herramienta, forzamos un retry explícito.
        const responseClaimsToHaveDone = claimsToHaveDone(assistantText);
        if (
          userAskedToStore &&
          totalToolUsesThisTurn === 0 &&
          responseClaimsToHaveDone
        ) {
          send({
            type: "delta",
            text: "\n\n[Detecté que dije haber hecho algo sin ejecutarlo. Corrigiendo…]\n\n",
          });
          assistantText +=
            "\n\n[Detecté que dije haber hecho algo sin ejecutarlo. Corrigiendo…]\n\n";

          const correctionMsg = `ATENCIÓN: en tu respuesta anterior dijiste haber ejecutado una acción (frases como "lo agregué", "listo", "guardado", etc.) pero NO llamaste ninguna herramienta. Eso es ALUCINACIÓN — el sistema lo detectó.

El usuario claramente pidió guardar contenido (su mensaje fue de ${userWordCount} palabras y/o usó verbos de inserción).

DEBES ejecutar AHORA la herramienta correcta:
- Para insertar contenido literal del usuario en una sección/lección existente: append_to_section con el contenido en HTML simple (<p>, <strong>, <em>, <h3>, <ul>, <ol>, <li>).
- Si el alcance del chat es "Esta sección" pero el contenido va a otra parte, primero pregunta dónde va; si el usuario ya dijo dónde, usa leave_suggestion en ese nodo.

NO respondas con texto sin ejecutar la herramienta. NO repitas la frase de "listo" hasta que la herramienta retorne ok:true.

Llama la herramienta AHORA con el contenido literal del usuario, formateado en HTML pero RESPETANDO sus palabras.`;

          messages.push({ role: "assistant", content: assistantText });
          messages.push({ role: "user", content: correctionMsg });

          // Una pasada más con la corrección — máximo 2 sub-loops para
          // permitir que la IA ejecute la tool y confirme.
          for (let retryLoop = 0; retryLoop < 2; retryLoop++) {
            const retryResp = await anthropic.messages.create({
              model: modeloId(modeloTarea),
              max_tokens: 4096,
              system: buildSystem(outlineText, outlineProgreso),
              tools: TOOLS,
              messages,
            });

            const usoRetry = usoDeRespuesta(retryResp.usage);
            await registrarUso({
              userId: user.id,
              projectId: project.id,
              accion: "chat",
              modelo: modeloTarea,
              inputTokens: usoRetry.input,
              outputTokens: usoRetry.output,
              cacheReadTokens: usoRetry.cacheRead,
              cacheWriteTokens: usoRetry.cacheWrite,
            });

            const retryBlocks = retryResp.content;
            for (const block of retryBlocks) {
              if (block.type === "text") {
                assistantText += "\n" + block.text;
                send({ type: "delta", text: block.text });
              }
            }
            const retryToolUses = retryBlocks.filter(
              (b): b is Anthropic.Messages.ToolUseBlock =>
                b.type === "tool_use"
            );
            totalToolUsesThisTurn += retryToolUses.length;
            if (
              retryToolUses.length === 0 ||
              retryResp.stop_reason !== "tool_use"
            ) {
              break;
            }
            const retryResults: Anthropic.Messages.ToolResultBlockParam[] = [];
            for (const tu of retryToolUses) {
              send({
                type: "tool",
                name: tu.name,
                input: tu.input,
                status: "running",
              });
              const result = await executeTool(
                tu.name,
                (tu.input ?? {}) as Record<string, unknown>,
                ctx
              );
              send({
                type: "tool",
                name: tu.name,
                status: result.ok ? "ok" : "error",
                error: result.ok ? undefined : result.error,
              });
              if (result.ok) outlineChanged = true;
              retryResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                is_error: !result.ok,
                content: result.ok
                  ? JSON.stringify(result.data ?? { ok: true })
                  : (result.error ?? "error"),
              });
            }
            messages.push({ role: "assistant", content: retryBlocks });
            messages.push({ role: "user", content: retryResults });
            if (outlineChanged) {
              outlineText = await renderOutlineWithIds(project.id, {
                conProgreso: false,
              });
              outlineProgreso = await renderOutlineProgress(project.id);
            }
          }
        }
      } catch (err) {
        // Notificamos el error SOLO por el stream SSE. NO lo concatenamos a
        // assistantText: si lo persistiéramos, ese "[error: ...]" entraría en
        // el priorHistory de futuras requests y contaminaría el contexto de
        // la IA.
        send({
          type: "error",
          error: err instanceof Error ? err.message : "stream error",
        });
        streamFailed = true;
      } finally {
        // Solo persistimos la respuesta del asistente si el turno NO falló y
        // produjo texto real. Un turno fallido no deja mensaje 'assistant'
        // envenenado en el historial.
        if (!streamFailed && assistantText.trim()) {
          await db.insert(aiMessages).values({
            id: nanoid(),
            projectId: project.id,
            nodeId: body.nodeId ?? null,
            role: "assistant",
            content: assistantText.trim(),
          });
        }
        send({ type: "end", outlineChanged });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

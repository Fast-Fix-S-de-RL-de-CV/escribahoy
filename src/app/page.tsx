import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/lib/auth";
import { ZigZag } from "@/components/landing/zigzag";
import { VgHero } from "@/components/landing/vg-hero";
import { VgOutline } from "@/components/landing/vg-outline";
import { VgEditor } from "@/components/landing/vg-editor";
import { VgSuggestion } from "@/components/landing/vg-suggestion";
import { VgChat } from "@/components/landing/vg-chat";
import { VgDecorations } from "@/components/landing/vg-decorations";
import { VgRules } from "@/components/landing/vg-rules";
import { VgCourse } from "@/components/landing/vg-course";

/**
 * Landing pública.
 *
 * Cada afirmación de esta página está respaldada por código verificado. Lo que
 * NO se promete, por no existir hoy, queda anotado aquí para que no vuelva a
 * colarse: exportar a PDF/EPUB/DOCX, deshacer o restaurar versiones, glosario
 * generado por IA, rachas de escritura, reordenar el temario arrastrando,
 * colaboración entre autores, y búsqueda semántica sobre el knowledge base.
 */
export default async function Home() {
  const user = await getCurrentUser();
  const startHref = user ? "/dashboard" : "/register";
  const startLabel = user ? "Ir al dashboard" : "Crear mi proyecto";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <Link href="/" className="flex items-center">
          <Logo size={34} wordmarkClassName="text-xl" />
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard">
              <Button>Ir al dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Iniciar sesión</Button>
              </Link>
              <Link href="/register">
                <Button>Empezar gratis</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-[var(--color-bg)] to-[var(--color-accent-soft)] px-6 pb-16 pt-16 sm:pt-20">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/15">
              <SparklesIcon className="h-3.5 w-3.5" />
              Escrito con Claude Opus
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Tu libro deja de ser una idea suelta{" "}
              <span className="text-[var(--color-accent)]">hoy mismo</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-fg-muted)]">
              Eliges el tamaño y las páginas, y EscribaHoy genera el temario completo con
              sus capítulos y secciones. Le cuentas tus ideas en el chat y las coloca
              donde van; cuando tú lo pides, desarrolla la sección con tu tono, tu
              glosario y tu voz.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={startHref}>
                <Button size="lg" className="gap-2">
                  {startLabel}
                  <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#como-funciona">
                <Button size="lg" variant="ghost">
                  Ver cómo funciona
                </Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-6xl">
            <VgHero />
          </div>
        </section>

        <ZigZag
          id="como-funciona"
          eyebrow="El temario primero"
          headline="Empiezas con el libro entero ya estructurado"
          body="Antes de escribir una línea eliges el tamaño físico real de tu libro y cuántas páginas quieres. Con esos números EscribaHoy calcula cuántos capítulos y secciones necesita, y genera el temario completo: preliminares, capítulos numerados con su resumen y páginas de cierre. Sales del asistente con la estructura puesta, no con una hoja en blanco."
          bullets={[
            "8 formatos de impresión con medidas reales, desde Bolsillo 4.25×6.87″ hasta Carta 8.5×11″, cada uno con su rango de páginas y sus palabras por página.",
            "El género cambia la estructura de verdad: una novela sale con capítulos corridos y un manual con secciones 3.1, 3.2, 3.3, cada uno con sus preliminares y su cierre.",
            "Si subes tus PDFs o notas antes de generar, ese material entra como referencia al armar los capítulos.",
          ]}
          media={<VgOutline />}
        />

        <ZigZag
          eyebrow="El editor"
          headline="Un espacio que se siente libro, no formulario"
          body="El texto se ve en serif a 18px con interlineado de libro, con títulos, listas y citas. Se guarda solo un segundo después de que dejas de teclear y el contador de palabras avanza contra el objetivo de esa sección. En un capítulo con secciones, el editor separa la apertura y el cierre de lo que va dentro de cada sección."
          bullets={[
            "Autoguardado con un segundo de espera: «Guardando…» y luego «Guardado hace 2m», sin botón que perseguir.",
            "«640 / 1,800 palabras» con barra de avance en cada sección, y en la barra superior el total del proyecto y cuántas secciones llevas completas.",
            "Vista de capítulo en tres bloques: apertura, tarjetas de secciones hijas con su número y su estado, y cierre opcional.",
          ]}
          media={<VgEditor />}
          flip
        />

        <ZigZag
          eyebrow="Sección por sección"
          headline="Ninguna sección tuya empieza en blanco"
          body="Cuando abres una sección, EscribaHoy ya está preparando un plan de qué cubrir: lee el capítulo completo, la sección anterior y la siguiente, y el texto que ya escribiste en las secciones hermanas para no repetirte. Tú decides cuánto escribe: por defecto organiza y propone, y solo desarrolla la sección completa cuando se lo pides con ese botón."
          bullets={[
            "El plan llega en viñetas de 100 a 300 palabras, citando tus archivos cuando aplica, y termina con una nota de tono.",
            "«Ejecutar sugerencia con IA» desarrolla la sección a sus palabras objetivo respetando tu tono, tu persona narrativa y tu glosario.",
            "Si escribiste el capítulo de corrido, «Redistribuir en secciones» lo acomoda sin inventar texto nuevo.",
          ]}
          media={<VgSuggestion />}
        />

        <ZigZag
          eyebrow="Chat editorial"
          headline="Le cuentas la idea y tu proyecto cambia"
          body="El panel derecho no te devuelve texto para copiar y pegar: ejecuta cambios en tu proyecto. Renombra un capítulo, agrega o mueve una sección, escribe en la sección abierta o guarda una idea suelta en el capítulo al que pertenece. Ves cada herramienta ejecutándose con su palomita."
          bullets={[
            "Nueve herramientas reales sobre tu proyecto: renombrar, cambiar resumen, agregar, eliminar, mover, anexar, reemplazar, insertar accesorio y dejar una idea en otro capítulo.",
            "Le cuentas una anécdota mientras trabajas en otra cosa y queda archivada en el capítulo correcto, con un globo numerado esperándote en el temario.",
            "Si la respuesta dice «listo» sin haber ejecutado ninguna herramienta, el sistema lo detecta y la obliga a hacerlo de verdad.",
          ]}
          media={<VgChat />}
          flip
        />

        <ZigZag
          eyebrow="Accesorios editoriales"
          headline="Detalles que hacen que parezca libro publicado"
          body="Frase destacada, epígrafe, tip, definición, ejercicio, recap y dato: siete bloques con maquetado propio que puedes insertar en cualquier página. La IA los propone a partir del texto que tú ya escribiste en esa sección, y te dice de dónde salió cada uno."
          bullets={[
            "El modal te muestra la fuente usada: del contenido escrito, del knowledge base o del conocimiento general.",
            "Pides otra versión y navegas entre alternativas antes de decidir; nada se inserta sin que tú lo apruebes.",
            "Cada tipo tiene su estilo maquetado, listo dentro del texto: la frase destacada con barra teal, el dato en bloque invertido con la cifra en serif grande.",
          ]}
          media={<VgDecorations />}
        />

        <ZigZag
          eyebrow="Tus reglas"
          headline="La IA escribe con tu voz y deja recibo"
          body="Defines una sola vez la persona narrativa, el trato al lector, la variante del español, los términos que sí quieres y los que no, y eso entra en todos los prompts: temario, sugerencias, desarrollo de secciones y accesorios. Mientras falte lo básico, la IA no escribe: te lo pide antes."
          bullets={[
            "Tu glosario obligatorio y tu lista de términos a evitar viajan en cada llamada como restricción explícita de vocabulario.",
            "Bloqueo real: sin la configuración mínima, las funciones de escritura devuelven error en vez de producir texto genérico.",
            "El historial agrupa por día y distingue con icono lo que hiciste tú de lo que hizo la IA, con fecha y autor.",
          ]}
          media={<VgRules />}
          flip
        />

        <ZigZag
          eyebrow="Modo curso"
          headline="De la lección escrita a grabar de corrido"
          body="Si tu proyecto es un curso, la estructura son módulos y lecciones, con su bienvenida y sus recursos finales. Cuando una lección ya tiene texto, un botón la convierte en guión hablado: frases cortas y pausas marcadas, sin inventar contenido nuevo."
          bullets={[
            "El guión se genera a partir de lo que tú escribiste, con la instrucción explícita de solo reformular.",
            "Teleprompter a pantalla completa, con velocidad y tamaño de letra ajustables y controles de reproducir, pausar y reiniciar.",
            "Es una función del modo curso: se genera por lección y requiere que la lección ya tenga palabras escritas.",
          ]}
          media={<VgCourse />}
        />

        {/* Cierre */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              El primer capítulo es el que nunca llega
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--color-fg-muted)]">
              Empieza por el temario. En unos minutos tienes la estructura completa de tu
              libro o tu curso y sabes exactamente qué escribir en cada sección.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={startHref}>
                <Button size="lg" className="gap-2">
                  {startLabel}
                  <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-xs text-[var(--color-fg-subtle)]">
              Tu obra es tuya: conservas la titularidad de todo lo que escribes.
            </p>
          </div>
        </section>
      </main>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[var(--color-border)] px-6 pt-5 text-xs text-[var(--color-fg-subtle)]">
        <Link href="/terminos" className="underline-offset-2 hover:text-[var(--color-accent)] hover:underline">
          Términos
        </Link>
        <Link href="/privacidad" className="underline-offset-2 hover:text-[var(--color-accent)] hover:underline">
          Aviso de privacidad
        </Link>
      </div>
      <SiteFooter />
    </div>
  );
}

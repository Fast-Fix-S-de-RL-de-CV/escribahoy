import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCardIcon,
  FileTextIcon,
  KeyRoundIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  Bullets,
  ContactBox,
  DocHeader,
  ExternalLink,
  Highlight,
  Item,
  MailLink,
  Numbers,
  P,
  Section,
  Sub,
  Term,
  Toc,
} from "../_parts";

export const metadata: Metadata = {
  title: "Términos y Condiciones — EscribaHoy",
  description:
    "Las reglas de uso de EscribaHoy: tu cuenta, el uso aceptable, el rol de la inteligencia artificial y por qué la titularidad de tu obra siempre es tuya.",
};

// Fecha estática a propósito (ver nota en /privacidad).
const UPDATED_AT = "28 de julio de 2026";
const CONTACT = "info@escribahoy.com";

const SECTIONS = [
  { id: "objeto", label: "Qué es EscribaHoy y qué te ofrecemos" },
  { id: "aceptacion", label: "Aceptación de estos términos" },
  { id: "cuenta", label: "Tu cuenta y tus credenciales" },
  { id: "uso-aceptable", label: "Uso aceptable" },
  { id: "propiedad", label: "Propiedad intelectual de tu obra" },
  { id: "licencia", label: "La licencia limitada que nos otorgas" },
  { id: "nuestra-pi", label: "Nuestra propiedad intelectual" },
  { id: "ia", label: "El rol de la inteligencia artificial" },
  { id: "disponibilidad", label: "Disponibilidad del servicio" },
  { id: "respaldos", label: "Respaldos y copias de tu contenido" },
  { id: "responsabilidad", label: "Limitación de responsabilidad" },
  { id: "costos", label: "Costo del servicio, planes y cobros" },
  { id: "terminacion", label: "Terminación de la cuenta y borrado de datos" },
  { id: "modificaciones", label: "Modificaciones a estos términos" },
  { id: "privacidad", label: "Privacidad" },
  { id: "ley", label: "Ley aplicable y jurisdicción" },
];

export default function TerminosPage() {
  return (
    <>
      <DocHeader
        title="Términos y Condiciones"
        updatedAt={UPDATED_AT}
        lead={
          <>
            Estos términos son el acuerdo entre tú y Fast Fix IT sobre el uso de
            EscribaHoy. Los escribimos para que se entiendan a la primera lectura:
            aquí está qué puedes esperar de nosotros, qué esperamos de ti y, sobre
            todo, la parte que más importa cuando escribes algo tuyo: la obra es y
            seguirá siendo tuya.
          </>
        }
      />

      <Toc items={SECTIONS} />

      <Section id="objeto" n={1} title="Qué es EscribaHoy y qué te ofrecemos">
        <P>
          EscribaHoy es una plataforma en línea, operada por{" "}
          <Term>Fast Fix IT</Term> (
          <ExternalLink href="https://fast-fix.com.mx">
            fast-fix.com.mx
          </ExternalLink>
          ), que te acompaña para escribir un libro o un curso. La plataforma te
          permite definir tu proyecto, construir un temario, escribir y editar tus
          capítulos, secciones, módulos o lecciones, subir material de referencia a
          una base de conocimiento y apoyarte en un asistente de inteligencia
          artificial que organiza y estructura tus ideas.
        </P>
        <P>
          El servicio es una <Term>herramienta de trabajo</Term>. No es una casa
          editorial, no es un servicio de publicación, no es una agencia literaria
          y no ofrece asesoría legal, fiscal, médica ni profesional de ningún tipo.
          No revisamos, editamos ni curamos tu obra por ti.
        </P>
      </Section>

      <Section id="aceptacion" n={2} title="Aceptación de estos términos">
        <P>
          Al crear una cuenta o usar EscribaHoy declaras que leíste y aceptas estos
          términos, junto con el{" "}
          <Link
            href="/privacidad"
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
          >
            Aviso de Privacidad
          </Link>
          . Declaras también que tienes capacidad legal para obligarte y que eres
          mayor de edad. Si no estás de acuerdo con alguna parte, la solución es
          simple: no uses el servicio.
        </P>
      </Section>

      <Section id="cuenta" n={3} title="Tu cuenta y tus credenciales">
        <Highlight icon={KeyRoundIcon} title="Tu contraseña es tuya y solo tuya">
          <P>
            No almacenamos tu contraseña en claro, así que nadie de nuestro equipo
            puede leerla ni te la puede recordar. Si la pierdes, se restablece por
            correo.
          </P>
        </Highlight>
        <Bullets>
          <Item>
            Eres responsable de la veracidad de los datos que registras y de
            mantenerlos actualizados, en especial tu correo electrónico, porque es
            el único canal para recuperar el acceso.
          </Item>
          <Item>
            Eres responsable de resguardar tus credenciales y de toda la actividad
            que ocurra dentro de tu cuenta. No compartas tu contraseña.
          </Item>
          <Item>
            La cuenta es personal. No la cedas, revendas ni la uses para dar
            servicio a terceros como si fuera tu propia herramienta.
          </Item>
          <Item>
            Si sospechas un acceso no autorizado, cambia tu contraseña de inmediato
            y avísanos a <MailLink address={CONTACT} /> para invalidar las sesiones
            activas.
          </Item>
        </Bullets>
      </Section>

      <Section id="uso-aceptable" n={4} title="Uso aceptable">
        <P>
          Puedes escribir sobre lo que quieras, con la libertad creativa que tu
          proyecto exija. Lo que no puedes hacer, y que da lugar a la suspensión de
          la cuenta, es:
        </P>
        <Bullets>
          <Item>
            Subir, generar o almacenar <Term>contenido ilícito</Term> conforme a la
            legislación mexicana: material de abuso infantil, apología o
            instrucciones para delitos, amenazas, incitación a la violencia,
            difusión de datos personales de terceros sin su consentimiento o
            contenido que promueva discriminación.
          </Item>
          <Item>
            <Term>Plagiar</Term>. No presentes como propia la obra de otra persona,
            ni uses la plataforma para reescribir texto ajeno con la intención de
            ocultar su origen.
          </Item>
          <Item>
            Subir a tu base de conocimiento <Term>contenido de terceros sobre el
            que no tengas derechos</Term> o autorización suficiente. Al cargar un
            archivo, declaras que eres su titular o que cuentas con permiso, o que
            su uso se ubica en una limitación o excepción legal como la cita.
          </Item>
          <Item>
            Suplantar la identidad de otra persona o atribuirle a alguien más la
            autoría de un texto.
          </Item>
          <Item>
            Intentar vulnerar la seguridad de la plataforma, acceder a datos o
            proyectos de otras cuentas, hacer ingeniería inversa, extraer datos de
            forma automatizada o sobrecargar la infraestructura de manera
            deliberada.
          </Item>
          <Item>
            Usar el servicio para generar spam, desinformación masiva o contenido
            fraudulento.
          </Item>
        </Bullets>
        <P>
          Si detectamos un incumplimiento grave o reiterado podemos suspender o
          cerrar la cuenta. Cuando las circunstancias lo permitan, te lo
          notificaremos primero y te daremos oportunidad de corregirlo o de exportar
          tu contenido.
        </P>
      </Section>

      <Section id="propiedad" n={5} title="Propiedad intelectual de tu obra">
        <Highlight
          icon={ShieldCheckIcon}
          title="Tu obra es tuya. Punto."
        >
          <P>
            <Term>
              Conservas en todo momento la titularidad de los derechos de autor y
              de cualquier otro derecho de propiedad intelectual sobre tu obra
            </Term>{" "}
            y sobre todo el contenido que creas o subes a EscribaHoy: tu temario,
            tus capítulos, tus lecciones, tus notas, tus archivos de referencia y
            tus conversaciones con el asistente.
          </P>
          <P>
            EscribaHoy y Fast Fix IT <Term>no adquieren</Term> la titularidad, la
            coautoría ni derechos patrimoniales sobre tu obra. Tampoco adquirimos
            derechos de edición, publicación, distribución, adaptación ni
            explotación comercial de ningún tipo.
          </P>
        </Highlight>
        <P>
          En consecuencia, y salvo lo estrictamente indispensable descrito en la
          sección 6, nos comprometemos expresamente a lo siguiente:
        </P>
        <Bullets>
          <Item>
            No publicamos, difundimos ni compartimos tu contenido con otros
            usuarios ni con el público.
          </Item>
          <Item>
            No vendemos, licenciamos ni cedemos tu contenido a terceros.
          </Item>
          <Item>
            No usamos tu obra como material promocional de EscribaHoy sin tu
            autorización previa y por escrito.
          </Item>
        </Bullets>
        <P>
          El registro de tu obra ante el Instituto Nacional del Derecho de Autor,
          así como cualquier trámite de ISBN, contratación editorial o gestión de
          regalías, corre por tu cuenta. Los derechos de autor nacen con la
          creación de la obra; el registro es un medio de prueba que te
          recomendamos considerar si vas a publicar.
        </P>
      </Section>

      <Section id="licencia" n={6} title="La licencia limitada que nos otorgas">
        <P>
          Para poder darte el servicio necesitamos permiso técnico para tocar tus
          archivos: sin él, literalmente no podríamos guardar un capítulo ni
          mostrártelo de vuelta. Por eso, y solo para eso, nos otorgas una licencia
          con estas características:
        </P>
        <Numbers>
          <Item>
            <Term>No exclusiva</Term>: sigues pudiendo hacer con tu obra
            absolutamente todo lo que quieras, en donde quieras y con quien
            quieras.
          </Item>
          <Item>
            <Term>Gratuita y sin regalías</Term>, y limitada al ámbito descrito
            aquí.
          </Item>
          <Item>
            <Term>Revocable</Term>: termina automáticamente cuando eliminas el
            contenido o cierras tu cuenta.
          </Item>
          <Item>
            <Term>Con una finalidad única</Term>: alojar, almacenar, respaldar,
            reproducir técnicamente, transmitir, mostrarte y procesar tu contenido
            con el fin exclusivo de operar la plataforma y de ejecutar las
            funciones que tú solicitas, incluidas las de inteligencia artificial
            descritas en la sección 7.
          </Item>
        </Numbers>
        <P>
          Esta licencia no nos permite ningún uso distinto. No es una cesión de
          derechos, no es una coedición y no crea sociedad alguna entre tú y
          nosotros.
        </P>
      </Section>

      <Section id="nuestra-pi" n={7} title="Nuestra propiedad intelectual">
        <P>
          Del otro lado, el software de EscribaHoy, su interfaz, su código, sus
          textos, su marca, su logotipo y su documentación son propiedad de Fast Fix
          IT o de sus licenciantes. Tu cuenta te da derecho a{" "}
          <Term>usar</Term> la plataforma, no a copiarla, revenderla ni crear un
          servicio derivado de ella.
        </P>
      </Section>

      <Section id="ia" n={8} title="El rol de la inteligencia artificial">
        <Highlight
          icon={SparklesIcon}
          title="La IA asiste. Tú eres el autor y el responsable final."
        >
          <P>
            El asistente de EscribaHoy funciona con modelos de inteligencia
            artificial de <Term>Anthropic</Term> (Claude). Su papel es organizar,
            estructurar y sugerir: ordenar tus ideas, proponer un temario, señalar
            huecos, ayudarte a ubicar un párrafo en el capítulo correcto. La
            dirección creativa, las decisiones y el texto final son tuyos.
          </P>
        </Highlight>
        <Bullets>
          <Item>
            <Term>La IA puede equivocarse.</Term> Puede generar información
            inexacta, fechas o datos incorrectos, referencias inexistentes o
            afirmaciones que suenan convincentes y no lo son. Es una limitación
            conocida de esta tecnología, no una falla del servicio.
          </Item>
          <Item>
            <Term>Tú debes revisar todo resultado antes de usarlo</Term>,
            publicarlo o compartirlo. Esto es especialmente importante si tu obra
            toca temas de salud, derecho, finanzas, seguridad o cualquier materia
            donde un error tenga consecuencias reales.
          </Item>
          <Item>
            <Term>No garantizamos originalidad ni ausencia de coincidencias.</Term>{" "}
            Un texto generado o sugerido puede parecerse a material existente. La
            verificación de originalidad y de derechos de terceros es tu
            responsabilidad.
          </Item>
          <Item>
            <Term>No garantizamos resultados idénticos.</Term> La misma instrucción
            puede producir respuestas distintas en momentos distintos, y los
            modelos disponibles pueden cambiar.
          </Item>
          <Item>
            Para operar estas funciones, los fragmentos de tu proyecto que hagan
            falta se envían a la API de Anthropic, que actúa como encargado del
            tratamiento. El detalle está en el{" "}
            <Link
              href="/privacidad"
              className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
            >
              Aviso de Privacidad
            </Link>
            .
          </Item>
          <Item>
            Si tu obra requiere declarar el uso de herramientas de inteligencia
            artificial —por política de una editorial, una plataforma de
            autopublicación, una institución educativa o una convocatoria—, esa
            declaración te corresponde a ti.
          </Item>
        </Bullets>
      </Section>

      <Section id="disponibilidad" n={9} title="Disponibilidad del servicio">
        <P>
          El servicio se proporciona <Term>&ldquo;tal cual&rdquo;</Term> y{" "}
          <Term>&ldquo;según disponibilidad&rdquo;</Term>. Hacemos un esfuerzo
          honesto por mantenerlo en línea y funcionando bien, pero, en la medida
          que la ley permita, no otorgamos garantías expresas ni implícitas de
          disponibilidad ininterrumpida, ausencia de errores, idoneidad para un
          propósito particular ni de que el servicio cumplirá expectativas
          específicas.
        </P>
        <P>
          Podemos realizar mantenimientos, actualizaciones, cambios en las
          funciones o suspensiones temporales. Cuando una interrupción sea
          programada y significativa, procuraremos avisarte con antelación
          razonable. También podemos depender de proveedores externos —como la API
          de inteligencia artificial— cuyas interrupciones están fuera de nuestro
          control.
        </P>
      </Section>

      <Section id="respaldos" n={10} title="Respaldos y copias de tu contenido">
        <Highlight icon={TriangleAlertIcon}>
          <P>
            Realizamos respaldos técnicos de la plataforma, pero{" "}
            <Term>te recomendamos mantener tus propias copias</Term> de lo que
            escribes. Es tu obra: conservar un respaldo propio es la práctica más
            sana, aquí y en cualquier herramienta.
          </P>
        </Highlight>
      </Section>

      <Section id="responsabilidad" n={11} title="Limitación de responsabilidad">
        <P>
          En la máxima medida permitida por la legislación aplicable, Fast Fix IT,
          su personal y sus proveedores no serán responsables por daños indirectos,
          incidentales, especiales, punitivos o consecuenciales, ni por lucro
          cesante, pérdida de oportunidades, pérdida de reputación o pérdida de
          datos derivados del uso o de la imposibilidad de uso del servicio.
        </P>
        <P>
          En particular, no somos responsables por:
        </P>
        <Bullets>
          <Item>
            El contenido que tú creas, subes o publicas, ni por las consecuencias de
            publicarlo.
          </Item>
          <Item>
            Reclamaciones de terceros por presunta infracción de derechos de autor u
            otros derechos relacionados con tu obra o con el material que subiste.
          </Item>
          <Item>
            Decisiones que tomes con base en resultados generados por la
            inteligencia artificial sin haberlos verificado.
          </Item>
          <Item>
            La pérdida de contenido causada por fallas ajenas a nuestro control, por
            el uso indebido de tu cuenta o por la eliminación que tú misma o tú
            mismo realices.
          </Item>
        </Bullets>
        <P>
          Nada de esta sección limita responsabilidades que por ley no puedan
          limitarse, ni los derechos que la legislación de protección al consumidor
          te reconozca.
        </P>
      </Section>

      <Section id="costos" n={12} title="Costo del servicio, planes y cobros">
        <Sub>El plan gratuito y los planes de paga</Sub>
        <P>
          EscribaHoy tiene un plan gratuito que no caduca y que{" "}
          <Term>no requiere tarjeta</Term>, y planes de paga con más capacidad de
          uso. Los precios vigentes, lo que incluye cada plan y sus límites de uso
          se publican en{" "}
          <Link
            href="/precios"
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
          >
            escribahoy.com/precios
          </Link>
          . Se cobran en <Term>pesos mexicanos</Term> y los montos exhibidos ya
          incluyen el IVA: el precio que ves es el total que se te cobra.
        </P>
        <P>
          Cada plan trae límites de uso de las funciones de inteligencia artificial
          (temarios, sugerencias, mensajes con el asistente, palabras de dictado y
          demás) que se reinician cada mes calendario. Esos límites forman parte de
          lo que contratas y están descritos en la página de precios. Si cambiamos
          los precios o los límites de un plan, te lo avisaremos conforme a la
          sección 14 y el cambio nunca aplicará de forma retroactiva a un periodo
          que ya pagaste.
        </P>

        <Sub>Quién procesa el pago</Sub>
        <Highlight icon={CreditCardIcon} title="Tu tarjeta la recibe Stripe, no nosotros">
          <P>
            El cobro lo procesa{" "}
            <ExternalLink href="https://stripe.com">Stripe</ExternalLink>, nuestro
            proveedor de pagos. Los datos de tu tarjeta se capturan directamente en
            su plataforma:{" "}
            <Term>EscribaHoy no los ve, no los almacena y no los transmite</Term>.
            De tu suscripción conservamos únicamente lo necesario para darte
            acceso y facturarte —el plan contratado, su periodo, su estado y los
            identificadores que Stripe nos devuelve—, como se detalla en el Aviso
            de Privacidad.
          </P>
        </Highlight>

        <Sub>Renovación automática</Sub>
        <P>
          Las suscripciones son de <Term>renovación automática</Term>: al terminar
          cada periodo (mensual o anual, según el que elijas) se genera un cargo
          nuevo con el mismo medio de pago, y así hasta que canceles. Al contratar
          autorizas expresamente esos cargos recurrentes; nunca se te cobra un
          concepto distinto al plan que elegiste sin tu autorización previa.
        </P>
        <P>
          Si un cobro es rechazado por tu banco, Stripe lo reintenta durante unos
          días. Mientras el periodo que ya pagaste siga vigente conservas tu
          acceso; si los reintentos se agotan sin éxito, la cuenta regresa al plan
          gratuito.
        </P>

        <Sub>Cancelación</Sub>
        <P>
          Puedes cancelar <Term>en cualquier momento</Term> y sin llamar a nadie,
          desde &ldquo;Administrar mi suscripción&rdquo; en la página de precios de
          tu cuenta. No hay plazos forzosos ni penalizaciones por cancelar.
        </P>
        <Bullets>
          <Item>
            Al cancelar conservas el acceso a tu plan{" "}
            <Term>hasta que termine el periodo que ya pagaste</Term>. No cortamos
            el servicio el mismo día ni prorrateamos devoluciones del tiempo
            restante, porque ese tiempo sigue siendo tuyo.
          </Item>
          <Item>
            Cuando el periodo concluye, la cuenta pasa al plan gratuito y aplican
            sus límites de uso.
          </Item>
          <Item>
            Bajar de plan o cancelar <Term>no borra tu contenido</Term>: tus
            proyectos, tu temario, lo que escribiste y tus archivos de base de
            conocimiento siguen ahí. Lo que cambia es cuánto puedes usar las
            funciones de inteligencia artificial y cuántos proyectos puedes tener
            activos a la vez. El borrado de contenido solo ocurre si tú lo pides,
            en los términos de la sección 13.
          </Item>
        </Bullets>
        <P>
          Los derechos que la Ley Federal de Protección al Consumidor te reconoce
          sobre cancelaciones, cargos indebidos y aclaraciones quedan a salvo en
          todo momento. Si detectas un cargo que no reconoces, escríbenos a{" "}
          <MailLink address={CONTACT} /> y lo revisamos contigo.
        </P>
      </Section>

      <Section
        id="terminacion"
        n={13}
        title="Terminación de la cuenta y borrado de datos"
      >
        <Sub>Cuando tú decides irte</Sub>
        <P>
          Puedes dejar de usar el servicio en cualquier momento y solicitar la
          eliminación de tu cuenta escribiendo a <MailLink address={CONTACT} />.
          Al eliminarla borramos tus proyectos, tu temario, tu contenido, tus
          archivos de base de conocimiento y tus conversaciones con el asistente,
          conforme a lo descrito en el Aviso de Privacidad. Este borrado es{" "}
          <Term>definitivo y no reversible</Term>: exporta o copia lo que quieras
          conservar antes de solicitarlo.
        </P>
        <Sub>Cuando nosotros suspendemos una cuenta</Sub>
        <P>
          Podemos suspender o terminar el acceso de una cuenta que incumpla la
          sección 4, que ponga en riesgo la seguridad de la plataforma o de otras
          personas, o cuando una autoridad competente lo ordene. Salvo que exista
          un impedimento legal o un riesgo grave, te avisaremos y te daremos un
          plazo razonable para solicitar una copia de tu contenido.
        </P>
        <Sub>Si el servicio se descontinúa</Sub>
        <P>
          Si en algún momento decidiéramos descontinuar EscribaHoy, te avisaríamos
          por correo con antelación razonable para que puedas recuperar tu
          contenido.
        </P>
      </Section>

      <Section id="modificaciones" n={14} title="Modificaciones a estos términos">
        <P>
          Podemos actualizar estos términos para reflejar cambios en el producto, en
          nuestros proveedores o en la ley. La versión vigente vivirá siempre en{" "}
          <Term>escribahoy.com/terminos</Term>, con su fecha de última
          actualización visible en el encabezado.
        </P>
        <P>
          Cuando el cambio sea relevante te lo avisaremos por correo electrónico o
          con un aviso dentro de la plataforma antes de que entre en vigor. Si no
          estás de acuerdo con la nueva versión, puedes dejar de usar el servicio y
          solicitar la eliminación de tu cuenta; el uso continuado después de la
          entrada en vigor implica su aceptación.
        </P>
      </Section>

      <Section id="privacidad" n={15} title="Privacidad">
        <P>
          El tratamiento de tus datos personales se rige por nuestro{" "}
          <Link
            href="/privacidad"
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
          >
            Aviso de Privacidad
          </Link>
          , que forma parte integral de estos términos. Ahí encontrarás qué datos
          recabamos, con qué finalidades, quiénes son nuestros encargados y cómo
          ejercer tus derechos ARCO.
        </P>
      </Section>

      <Section id="ley" n={16} title="Ley aplicable y jurisdicción">
        <Highlight icon={ScaleIcon}>
          <P>
            Estos términos se rigen por las leyes federales de los{" "}
            <Term>Estados Unidos Mexicanos</Term>. Para la interpretación y el
            cumplimiento de este acuerdo, las partes se someten a la jurisdicción
            de los tribunales competentes en México, sin perjuicio de los derechos
            que la legislación de protección al consumidor te reconozca ni de la
            competencia de las autoridades administrativas correspondientes.
          </P>
        </Highlight>
        <P>
          Si alguna cláusula de estos términos se considerara inválida o
          inejecutable, las demás seguirán en pleno vigor. El hecho de que no
          ejerzamos de inmediato un derecho previsto aquí no significa que
          renunciemos a él.
        </P>
      </Section>

      <ContactBox address={CONTACT}>
        <P className="text-sm">
          Si necesitas nuestro domicilio para una notificación por escrito,
          solicítalo a ese mismo correo y te lo enviamos.
        </P>
      </ContactBox>

      <p className="mt-8 flex items-center gap-2 text-sm text-[var(--color-fg-subtle)]">
        <FileTextIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
        Términos y Condiciones de EscribaHoy, vigentes desde el {UPDATED_AT}.
      </p>
    </>
  );
}

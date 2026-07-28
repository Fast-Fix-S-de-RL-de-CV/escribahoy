import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenIcon,
  CookieIcon,
  LockIcon,
  SparklesIcon,
  UserCheckIcon,
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
  title: "Aviso de Privacidad — EscribaHoy",
  description:
    "Cómo tratamos tus datos personales y el contenido de tus proyectos en EscribaHoy, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
};

// Fecha estática a propósito: un aviso de privacidad debe declarar cuándo se
// actualizó por última vez, no la fecha en que el visitante abre la página.
const UPDATED_AT = "28 de julio de 2026";
const CONTACT = "info@escribahoy.com";

const SECTIONS = [
  { id: "responsable", label: "Quién es responsable de tus datos" },
  { id: "datos", label: "Qué datos recabamos" },
  { id: "finalidades", label: "Para qué usamos tus datos (finalidades primarias)" },
  { id: "secundarias", label: "Finalidades secundarias (opcionales)" },
  { id: "ia", label: "El papel de la inteligencia artificial" },
  { id: "terceros", label: "Encargados y transferencias" },
  { id: "cookies", label: "Cookies que usamos" },
  { id: "seguridad", label: "Cómo protegemos tu información" },
  { id: "conservacion", label: "Cuánto tiempo conservamos tus datos" },
  { id: "arco", label: "Tus derechos ARCO y cómo ejercerlos" },
  { id: "revocacion", label: "Revocar tu consentimiento" },
  { id: "limitar", label: "Limitar el uso o divulgación de tus datos" },
  { id: "menores", label: "Menores de edad" },
  { id: "cambios", label: "Cambios a este aviso" },
  { id: "autoridad", label: "Autoridad en materia de protección de datos" },
];

export default function PrivacidadPage() {
  return (
    <>
      <DocHeader
        title="Aviso de Privacidad"
        updatedAt={UPDATED_AT}
        lead={
          <>
            En EscribaHoy trabajas con algo muy personal: el libro o el curso que
            estás escribiendo. Este aviso explica, sin rodeos, qué datos
            recabamos, para qué los usamos, con quién los compartimos para poder
            operar y cómo puedes controlarlos en cualquier momento. Está
            redactado conforme a la Ley Federal de Protección de Datos Personales
            en Posesión de los Particulares (LFPDPPP) y su normativa derivada.
          </>
        }
      />

      <Toc items={SECTIONS} />

      <Section id="responsable" n={1} title="Quién es responsable de tus datos">
        <P>
          El responsable del tratamiento de tus datos personales es{" "}
          <Term>Fast Fix IT</Term>, desarrollador y operador de la plataforma
          EscribaHoy, disponible en escribahoy.com. Puedes conocer más sobre
          nosotros en{" "}
          <ExternalLink href="https://fast-fix.com.mx">
            fast-fix.com.mx
          </ExternalLink>
          .
        </P>
        <P>
          Nuestro medio de contacto para todo lo relacionado con datos personales
          es el correo <MailLink address={CONTACT} />. Si necesitas nuestro
          domicilio para presentar una solicitud o notificación por escrito, lo
          proporcionamos a petición expresa: solicítalo a ese mismo correo y te
          lo enviamos.
        </P>
      </Section>

      <Section id="datos" n={2} title="Qué datos recabamos">
        <P>
          Recabamos únicamente lo que hace falta para que tengas una cuenta y para
          que la plataforma funcione. En concreto:
        </P>
        <Sub>Datos de tu cuenta</Sub>
        <Bullets>
          <Item>
            <Term>Nombre</Term>: el que tú escribes al registrarte. Lo usamos para
            dirigirnos a ti en la interfaz y en los correos.
          </Item>
          <Item>
            <Term>Correo electrónico</Term>: es tu identificador para iniciar
            sesión y el canal por el que te enviamos avisos de la cuenta
            (bienvenida, restablecimiento de contraseña, cambio de contraseña).
          </Item>
          <Item>
            <Term>Contraseña</Term>: nunca la almacenamos en claro. Guardamos
            únicamente un valor cifrado de forma irreversible con el algoritmo
            bcrypt. Ni nosotros podemos leerla ni recuperarla; solo puede
            restablecerse.
          </Item>
        </Bullets>

        <Sub>Contenido que tú creas o subes</Sub>
        <P>
          Para prestar el servicio necesitamos almacenar lo que escribes. No es
          &ldquo;dato personal&rdquo; en el sentido clásico, pero lo tratamos con
          el mismo cuidado porque es tu obra:
        </P>
        <Bullets>
          <Item>
            Tus <Term>proyectos</Term> (libro o curso) y su configuración: título,
            subtítulo, descripción, público al que va dirigido, tono, objetivo,
            formato, notas de estilo, glosario y términos a evitar.
          </Item>
          <Item>
            El <Term>temario y el texto de tus capítulos, secciones, módulos o
            lecciones</Term>, incluidas las versiones intermedias y el registro de
            cambios de tu proyecto.
          </Item>
          <Item>
            Los <Term>archivos de tu base de conocimiento</Term> (por ejemplo PDF,
            .txt o .md) y el texto extraído de ellos, que usamos como material de
            referencia para tu proyecto.
          </Item>
          <Item>
            Los <Term>mensajes que intercambias con el asistente de IA</Term>{" "}
            dentro de la plataforma.
          </Item>
          <Item>
            Estadísticas propias de tu avance, como palabras escritas por día,
            para mostrarte tu progreso.
          </Item>
        </Bullets>

        <Sub>Lo que NO recabamos</Sub>
        <Bullets>
          <Item>
            No recabamos <Term>datos personales sensibles</Term> (origen racial o
            étnico, estado de salud, información genética, creencias religiosas o
            filosóficas, afiliación sindical, opiniones políticas o preferencia
            sexual). Si tú decides incluir información de este tipo dentro del
            texto de tu obra, lo haces por tu cuenta y bajo tu control editorial.
          </Item>
          <Item>
            No solicitamos <Term>datos financieros o de medios de pago</Term>. Hoy
            la plataforma no procesa cobros.
          </Item>
          <Item>
            No usamos herramientas de <Term>analítica, publicidad ni rastreo de
            terceros</Term>. No hay píxeles publicitarios ni cookies de
            seguimiento en EscribaHoy.
          </Item>
        </Bullets>
      </Section>

      <Section
        id="finalidades"
        n={3}
        title="Para qué usamos tus datos (finalidades primarias)"
      >
        <P>
          Estas finalidades son <Term>necesarias</Term>: sin ellas simplemente no
          podríamos darte el servicio que estás pidiendo.
        </P>
        <Numbers>
          <Item>
            <Term>Crear y operar tu cuenta</Term>: registrarte, autenticarte,
            mantener tu sesión abierta y asociar tus proyectos a tu usuario.
          </Item>
          <Item>
            <Term>Prestar el servicio</Term>: almacenar, mostrar, organizar y
            permitirte editar tus proyectos, tu temario, tu contenido y tu base de
            conocimiento.
          </Item>
          <Item>
            <Term>Procesar tu contenido con inteligencia artificial</Term> cuando
            tú lo solicitas, para generar temarios, sugerencias, reorganización de
            ideas y respuestas del asistente (ver la sección 5).
          </Item>
          <Item>
            <Term>Seguridad</Term>: prevenir accesos no autorizados, detectar
            abusos, conservar registros técnicos mínimos de operación y responder a
            incidentes.
          </Item>
          <Item>
            <Term>Notificaciones transaccionales</Term>: correos indispensables de
            la cuenta, como bienvenida, restablecimiento de contraseña,
            confirmación de cambio de contraseña y avisos importantes sobre el
            servicio o sobre este aviso.
          </Item>
          <Item>
            <Term>Cumplimiento legal</Term>: atender requerimientos de autoridad
            competente debidamente fundados y motivados.
          </Item>
        </Numbers>
      </Section>

      <Section id="secundarias" n={4} title="Finalidades secundarias (opcionales)">
        <Highlight
          icon={UserCheckIcon}
          title="Puedes decir no, y tu cuenta sigue funcionando igual"
        >
          <P>
            Las finalidades de abajo <Term>no son necesarias</Term> para prestarte
            el servicio. Negarte a ellas no es motivo para negarte la cuenta ni
            para limitarte funciones.
          </P>
        </Highlight>
        <Bullets>
          <Item>
            Enviarte comunicaciones no esenciales: novedades del producto, guías
            para escribir mejor, consejos de uso y encuestas de opinión.
          </Item>
          <Item>
            Contactarte para pedirte retroalimentación o invitarte a probar
            funciones nuevas.
          </Item>
        </Bullets>
        <P>
          <Term>Cómo negarte:</Term> envía un correo a{" "}
          <MailLink address={CONTACT} /> con el asunto{" "}
          <Term>&ldquo;Sin finalidades secundarias&rdquo;</Term> desde la dirección
          registrada en tu cuenta. También puedes usar el enlace para darte de baja
          que incluimos al pie de cualquier correo no esencial. Tienes cinco días
          hábiles a partir de que se te da a conocer este aviso para manifestar tu
          negativa, y puedes hacerlo también en cualquier momento posterior.
        </P>
      </Section>

      <Section id="ia" n={5} title="El papel de la inteligencia artificial">
        <Highlight icon={SparklesIcon} title="Tu contenido se envía a Anthropic para que la IA funcione">
          <P>
            Las funciones de inteligencia artificial de EscribaHoy operan sobre la
            API de <Term>Anthropic</Term> (modelos Claude). Cuando pides un
            temario, una sugerencia o le escribes al asistente, enviamos a esa API
            los fragmentos de tu proyecto que hacen falta para atender tu
            petición: la configuración del proyecto, el temario, el texto de la
            sección en la que trabajas, extractos de tu base de conocimiento y tus
            mensajes.
          </P>
        </Highlight>
        <P>
          Anthropic actúa como <Term>encargado</Term> del tratamiento: procesa esa
          información por cuenta y siguiendo instrucciones de Fast Fix IT, con la
          finalidad exclusiva de devolver el resultado que tú pediste. No es una
          transferencia con fines comerciales ni una cesión de tu obra.
        </P>
        <P>
          Si prefieres que un texto no se procese con IA, no lo incluyas en las
          peticiones al asistente: puedes escribir y editar tus capítulos de forma
          manual, sin usar las funciones de inteligencia artificial.
        </P>
      </Section>

      <Section id="terceros" n={6} title="Encargados y transferencias">
        <P>
          <Term>No vendemos, alquilamos ni comercializamos tus datos personales
          ni tu contenido.</Term> Solo intervienen los proveedores estrictamente
          necesarios para operar:
        </P>
        <Bullets>
          <Item>
            <Term>Anthropic</Term> (encargado): procesamiento con inteligencia
            artificial de los fragmentos de contenido que tú solicitas trabajar,
            según la sección 5.
          </Item>
          <Item>
            <Term>Infraestructura de Fast Fix IT</Term>: los servidores y las bases
            de datos donde vive tu cuenta y tu contenido son administrados por
            nosotros.
          </Item>
          <Item>
            <Term>Servicio de correo saliente</Term>: usamos nuestro propio
            servidor de correo para enviarte los mensajes transaccionales de la
            cuenta.
          </Item>
        </Bullets>
        <P>
          Estas comunicaciones a encargados no requieren tu consentimiento
          adicional, conforme a la LFPDPPP, porque son indispensables para
          prestarte el servicio que solicitaste. Fuera de estos casos, no
          realizamos transferencias de tus datos a terceros, salvo requerimiento
          de autoridad competente debidamente fundado y motivado.
        </P>
      </Section>

      <Section id="cookies" n={7} title="Cookies que usamos">
        <Highlight icon={CookieIcon} title="Dos cookies propias, ninguna de terceros">
          <P>
            EscribaHoy no usa cookies publicitarias, de analítica ni de perfilado.
            Solo usamos estas dos, ambas propias:
          </P>
        </Highlight>
        <Bullets>
          <Item>
            <Term>escribahoy_session</Term> — cookie técnica indispensable que
            mantiene tu sesión abierta después de iniciar sesión. Contiene un
            identificador aleatorio de sesión, no tus datos. Es{" "}
            <Term>httpOnly</Term> (el código del navegador no puede leerla) y viaja
            cifrada por HTTPS. Al crear tu cuenta, y cuando al iniciar sesión
            marcas la casilla para mantener la sesión abierta, dura hasta 30 días;
            si inicias sesión sin marcarla, se borra al cerrar el navegador.
          </Item>
          <Item>
            <Term>escribahoy_remember_email</Term> — cookie de comodidad que
            guarda tu correo para prellenarlo la próxima vez que entres a la
            pantalla de inicio de sesión. Se crea al registrarte y cuando marcas
            esa casilla al iniciar sesión; si inicias sesión sin marcarla, la
            borramos. No guarda tu contraseña.
          </Item>
        </Bullets>
        <P>
          Puedes borrar o bloquear estas cookies desde la configuración de tu
          navegador en cualquier momento. Si bloqueas la cookie de sesión, no será
          posible mantenerte autenticado y la plataforma dejará de funcionar para
          ti.
        </P>
      </Section>

      <Section id="seguridad" n={8} title="Cómo protegemos tu información">
        <Highlight icon={LockIcon}>
          <P>
            Aplicamos medidas administrativas, técnicas y físicas razonables para
            proteger tus datos contra daño, pérdida, alteración, destrucción o uso,
            acceso y tratamiento no autorizados.
          </P>
        </Highlight>
        <Bullets>
          <Item>
            Las contraseñas se guardan con <Term>hash bcrypt</Term>, nunca en
            texto claro y sin posibilidad de revertirse.
          </Item>
          <Item>
            Todo el tráfico entre tu navegador y la plataforma viaja cifrado por{" "}
            <Term>HTTPS</Term>.
          </Item>
          <Item>
            Las sesiones son de un solo uso, expiran y se invalidan en el servidor
            al cerrar sesión.
          </Item>
          <Item>
            Cada consulta a tu contenido se valida contra tu usuario:{" "}
            <Term>nadie más puede leer tus proyectos</Term> desde la plataforma.
          </Item>
          <Item>
            El acceso del personal de Fast Fix IT a la infraestructura está
            limitado a lo necesario para operar y dar soporte.
          </Item>
        </Bullets>
        <P>
          Ningún sistema es infalible. Si detectamos una vulneración de seguridad
          que afecte de forma significativa tus derechos, te lo comunicaremos por
          correo electrónico sin dilación, junto con las medidas que estamos
          tomando y las que te recomendamos tomar.
        </P>
      </Section>

      <Section id="conservacion" n={9} title="Cuánto tiempo conservamos tus datos">
        <P>
          Conservamos tus datos de cuenta y tu contenido mientras tu cuenta esté
          activa. Si solicitas la cancelación de tus datos o la eliminación de tu
          cuenta, borramos tu información de nuestra base de datos operativa,
          incluidos tus proyectos, tu temario, tu contenido, tus archivos de base
          de conocimiento y tus conversaciones con el asistente.
        </P>
        <P>
          Los respaldos técnicos pueden retener copias por un periodo breve
          adicional hasta que se sobrescriben en su ciclo normal de rotación.
          Únicamente conservamos por más tiempo aquello que una obligación legal
          nos exija resguardar.
        </P>
      </Section>

      <Section id="arco" n={10} title="Tus derechos ARCO y cómo ejercerlos">
        <P>
          La ley te reconoce cuatro derechos sobre tus datos personales, conocidos
          como <Term>derechos ARCO</Term>:
        </P>
        <Bullets>
          <Item>
            <Term>Acceso</Term>: saber qué datos tuyos tenemos y cómo los usamos.
          </Item>
          <Item>
            <Term>Rectificación</Term>: corregir datos inexactos o incompletos.
          </Item>
          <Item>
            <Term>Cancelación</Term>: pedir que eliminemos tus datos de nuestras
            bases.
          </Item>
          <Item>
            <Term>Oposición</Term>: pedir que dejemos de usar tus datos para
            finalidades específicas.
          </Item>
        </Bullets>
        <Sub>Dónde se solicita</Sub>
        <P>
          Envía tu solicitud a <MailLink address={CONTACT} />, de preferencia desde
          el correo con el que te registraste. Para poder atenderte, tu solicitud
          debe incluir:
        </P>
        <Numbers>
          <Item>Tu nombre y un correo o medio para comunicarte la respuesta.</Item>
          <Item>
            Un documento que acredite tu identidad (identificación oficial vigente)
            o, si actúas por medio de representante, el documento que acredite su
            personalidad.
          </Item>
          <Item>
            La descripción clara de los datos sobre los que buscas ejercer tu
            derecho y qué derecho quieres ejercer.
          </Item>
          <Item>
            Cualquier elemento que nos ayude a localizar los datos, por ejemplo el
            nombre de tus proyectos.
          </Item>
        </Numbers>
        <Sub>Plazos de respuesta</Sub>
        <P>
          Te responderemos en un plazo máximo de <Term>20 días hábiles</Term>{" "}
          contados desde la recepción de tu solicitud, indicándote si procede. Si
          procede, la haremos efectiva dentro de los <Term>15 días hábiles</Term>{" "}
          siguientes a que te comuniquemos la respuesta. Los plazos pueden
          ampliarse una sola vez por un periodo igual cuando las circunstancias del
          caso lo justifiquen, y en ese caso te lo notificaremos. El ejercicio de
          estos derechos es gratuito; solo podríamos cobrarte los gastos
          justificados de envío o de reproducción en copias u otros formatos.
        </P>
        <P>
          Ten en cuenta que la cancelación puede no proceder en los casos que la
          propia ley señala, por ejemplo cuando debamos conservar los datos para
          cumplir una obligación legal.
        </P>
      </Section>

      <Section id="revocacion" n={11} title="Revocar tu consentimiento">
        <P>
          Puedes revocar en cualquier momento el consentimiento que nos otorgaste
          para tratar tus datos personales. Escríbenos a{" "}
          <MailLink address={CONTACT} /> con el asunto{" "}
          <Term>&ldquo;Revocación de consentimiento&rdquo;</Term> y te confirmaremos
          la recepción y el efecto de tu solicitud dentro de los mismos plazos de
          la sección anterior.
        </P>
        <P>
          Debemos ser claros: si revocas el consentimiento para las finalidades
          primarias, ya no podremos mantener tu cuenta ni almacenar tus proyectos,
          por lo que la revocación implica el cierre de la cuenta. Te
          recomendamos exportar o copiar tu contenido antes de solicitarla. La
          revocación no tiene efectos retroactivos sobre tratamientos ya
          realizados de forma lícita.
        </P>
      </Section>

      <Section id="limitar" n={12} title="Limitar el uso o divulgación de tus datos">
        <P>
          Además de los derechos ARCO, puedes pedirnos que limitemos el uso o la
          divulgación de tus datos sin llegar a cancelarlos: por ejemplo, dejar de
          recibir cualquier comunicación no esencial o quedar inscrito en un
          listado interno de exclusión. Solicítalo a{" "}
          <MailLink address={CONTACT} /> y te confirmaremos por escrito que quedó
          registrado.
        </P>
      </Section>

      <Section id="menores" n={13} title="Menores de edad">
        <P>
          EscribaHoy está pensado para personas mayores de edad. No recabamos
          intencionalmente datos de menores de 18 años. Si eres madre, padre o
          tutor y detectas que una persona menor de edad creó una cuenta sin tu
          autorización, escríbenos a <MailLink address={CONTACT} /> y procederemos
          a eliminarla junto con su información.
        </P>
      </Section>

      <Section id="cambios" n={14} title="Cambios a este aviso">
        <P>
          Este aviso puede cambiar, por ejemplo si agregamos funciones nuevas, si
          cambia un proveedor o si cambia la normativa aplicable. Cuando eso pase:
        </P>
        <Bullets>
          <Item>
            Publicaremos la versión vigente en esta misma página,{" "}
            <Term>escribahoy.com/privacidad</Term>, actualizando la fecha de
            &ldquo;Última actualización&rdquo; del encabezado.
          </Item>
          <Item>
            Si el cambio es sustancial —por ejemplo, una finalidad nueva o un
            encargado nuevo— te lo avisaremos por correo electrónico a la
            dirección registrada en tu cuenta, o con un aviso visible dentro de la
            plataforma, antes de que entre en vigor.
          </Item>
        </Bullets>
        <P>
          Te sugerimos revisar esta página de tanto en tanto. El uso continuado del
          servicio después de que un cambio entre en vigor implica que lo conoces.
        </P>
      </Section>

      <Section
        id="autoridad"
        n={15}
        title="Autoridad en materia de protección de datos"
      >
        <P>
          Si consideras que tu derecho a la protección de datos personales fue
          vulnerado, o que en nuestra respuesta hubo alguna conducta indebida,
          puedes presentar tu queja o denuncia ante la autoridad federal competente
          en materia de protección de datos personales en México. Antes de llegar
          ahí, nos gustaría intentar resolverlo directamente contigo:
          escríbenos y lo revisamos.
        </P>
      </Section>

      <ContactBox address={CONTACT}>
        <P className="text-sm">
          Consulta también nuestros{" "}
          <Link
            href="/terminos"
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
          >
            Términos y Condiciones
          </Link>
          , donde explicamos que tu obra sigue siendo tuya.
        </P>
      </ContactBox>

      <p className="mt-8 flex items-center gap-2 text-sm text-[var(--color-fg-subtle)]">
        <BookOpenIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
        Aviso de privacidad integral de EscribaHoy, vigente desde el{" "}
        {UPDATED_AT}.
      </p>
    </>
  );
}

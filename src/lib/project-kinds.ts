export type ProjectKind = {
  id: string;
  label: string;
  desc: string;
  examples: string;
};

export const BOOK_KINDS: ProjectKind[] = [
  {
    id: "novela",
    label: "Novela",
    desc: "Una historia inventada con personajes, tramas y escenas. Cuenta lo que pasa, no enseñas nada explícito — el lector saca sus conclusiones.",
    examples: "Como: Cien años de soledad, Harry Potter, Pedro Páramo.",
  },
  {
    id: "memoria",
    label: "Memoria / Autobiografía",
    desc: "Tu historia real contada en primera persona. Lo que viviste, momentos clave, lo que aprendiste. Cronológica o por temas.",
    examples: "Como: Open de Andre Agassi, Sapiens del autor (no), Vivir para contarla de García Márquez.",
  },
  {
    id: "ensayo",
    label: "Ensayo",
    desc: "Defiendes una sola idea con argumentos, ejemplos y reflexión. Como un artículo largo y profundo.",
    examples: "Como: Sobre la libertad de Mill, En defensa de la lentitud, ensayos de Paul Graham.",
  },
  {
    id: "no-ficcion",
    label: "No-ficción narrativa",
    desc: "Historias REALES escritas como novela. Periodismo largo, biografías de empresas, relatos de eventos. Cuentas hechos reales con voz literaria.",
    examples: "Como: Sapiens, Steve Jobs de Walter Isaacson, A sangre fría de Capote.",
  },
  {
    id: "auto-ayuda",
    label: "Auto-ayuda / Desarrollo personal",
    desc: "Enseñas un cambio personal: hábitos, mentalidad, productividad, relaciones. Mezclas tu experiencia con principios prácticos.",
    examples: "Como: Atomic Habits, Los 7 hábitos, Eat that Frog (Brian Tracy), El monje que vendió su Ferrari.",
  },
  {
    id: "manual",
    label: "Manual práctico / How-to",
    desc: "Pasos concretos para LOGRAR algo específico. El lector termina sabiendo HACER. Recetas, guías, procedimientos numerados.",
    examples: "Como: Cómo ganar amigos de Carnegie, manuales de cocina, On Writing de King.",
  },
  {
    id: "tecnico",
    label: "Técnico / Profesional",
    desc: "Conocimiento experto de un área específica. Lenguaje preciso, cuidado de los términos.",
    examples: "Como: Clean Code, libros de medicina, derecho fiscal, Designing Data-Intensive Applications.",
  },
  {
    id: "negocios",
    label: "Negocios / Liderazgo",
    desc: "Estrategia, marketing, ventas, gestión. Mezclas tus historias y casos reales con principios. Ideal si quieres enseñar a emprender o vender.",
    examples: "Como: Padre Rico Padre Pobre, Goals! (Brian Tracy), Zero to One, $100M Offers de Hormozi.",
  },
  {
    id: "academico",
    label: "Académico / Investigación",
    desc: "Citado, riguroso, con metodología y bibliografía. Tesis, papers extendidos, libros universitarios.",
    examples: "Como: Capital en el siglo XXI, libros de cátedra, monografías universitarias.",
  },
  {
    id: "infantil",
    label: "Infantil / Juvenil",
    desc: "Lenguaje simple, ilustraciones imaginadas, edad objetivo definida. Historia o concepto explicado para niños.",
    examples: "Como: El Principito, Diario de Greg, libros de Dr. Seuss.",
  },
  {
    id: "poesia",
    label: "Poesía",
    desc: "Compilación de poemas. Lenguaje cuidado, ritmo, forma e imagen importan más que la trama.",
    examples: "Como: Veinte poemas de amor de Neruda, poemarios de Sabines, Mario Benedetti.",
  },
  {
    id: "cuentos",
    label: "Cuentos cortos",
    desc: "Colección de historias breves independientes. Cada cuento se sostiene solo. Pueden tener tema común o ser variados.",
    examples: "Como: Final del juego de Cortázar, cuentos de Borges, Bestiario.",
  },
];

export const COURSE_KINDS: ProjectKind[] = [
  {
    id: "bootcamp",
    label: "Bootcamp intensivo",
    desc: "Curso largo y profundo. El alumno termina dominando una habilidad nueva de cero. Mucho contenido, mucha práctica.",
    examples: "Como: bootcamps de programación, MasterClass de Aaron Sorkin, Le Wagon, Ironhack.",
  },
  {
    id: "taller-practico",
    label: "Taller práctico",
    desc: "Hands-on. El alumno CONSTRUYE algo concreto siguiendo los pasos de cada lección. Salida tangible.",
    examples: "Como: 'Construye tu primera app en 7 días', talleres de Domestika, Skillshare.",
  },
  {
    id: "masterclass",
    label: "Masterclass / Lección magistral",
    desc: "Una clase magistral por experto. Densa, sin tarea formal, para aprender una idea grande o una visión.",
    examples: "Como: clases de MasterClass.com, TED talks largas, conferencias de Tim Ferriss.",
  },
  {
    id: "fundamentos",
    label: "Curso de fundamentos",
    desc: "Lo básico de un tema desde cero. Conceptos, vocabulario, primeros pasos. Para quien nunca ha tocado el tema.",
    examples: "Como: 'Inversiones para principiantes', 'Marketing 101', 'Inglés básico A1'.",
  },
  {
    id: "certificacion",
    label: "Curso de certificación",
    desc: "Termina en un examen, una credencial o un proyecto evaluado. Cubre un syllabus oficial o estándar.",
    examples: "Como: prep AWS Solutions Architect, prep TOEFL, certificación PMP.",
  },
  {
    id: "transformacion",
    label: "Programa de transformación",
    desc: "Mezcla mentoría, ejercicios y coaching. Cambio personal o profesional profundo. Más alto-ticket.",
    examples: "Como: programas de Tony Robbins, mastermind de productividad, coaching de Dan Sullivan.",
  },
  {
    id: "tecnico",
    label: "Curso técnico",
    desc: "Programación, herramientas, software, hardware. Con ejemplos de código y demos en vivo.",
    examples: "Como: cursos de Frontend Masters, Pluralsight, Udemy de Python o React.",
  },
  {
    id: "creativo",
    label: "Curso creativo",
    desc: "Escritura, diseño, fotografía, música, cocina. Centrado en producir obra propia.",
    examples: "Como: cursos de Domestika, MasterClass de fotografía, talleres de escritura creativa.",
  },
];

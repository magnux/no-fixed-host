import { catalogTranslation } from './catalog-languages.js';
import { journalTranslation } from './journal-languages.js';
import { menus } from './menu-languages.js';

const spanish = {
  'Finance': 'Finanzas', 'Campaign spending': 'Gastos de la partida',
  'Paid or reserved': 'Pagado o reservado', 'Returned': 'Devuelto',
  'Purchases and reservations will appear here.': 'Aquí aparecerán las compras y las reservas.',
  'Research licenses': 'Licencias de investigación', 'Research rentals': 'Alquiler de cómputo',
  'Processor boosts': 'Aceleración de procesadores', 'Contractor surcharges': 'Recargos de contratistas',
  'Datacenter acquisitions': 'Compra de centros de datos', 'Replacement retainers': 'Contratos de sustitución',
  'Standby reserves': 'Reservas para nodos de respaldo', 'Public campaigns': 'Campañas públicas',
  'Observer payments': 'Pagos a observadores', 'Commissioned studies': 'Estudios encargados',
  'Capacity from boosts': 'Capacidad adicional por aceleración', 'Unused boost capacity': 'Aceleración sin usar',
  'External research work': 'Cómputo externo de investigación', 'Rental funds returned': 'Fondos de alquiler devueltos',
  'Upkeep covered by standby reserve': 'Mantenimiento cubierto por la reserva',
  "Shift": "Mayús",
  "Esc": "Esc",
  "Enter": "Intro",
  "Restore the checkpoint “{name}” and replace the current autosave?": "¿Cargar la partida «{name}» y sustituir el guardado automático actual?",
  "Replace the saved checkpoint “{name}”?": "¿Sobrescribir la partida guardada «{name}»?",
  "Delete the checkpoint “{name}”?": "¿Eliminar la partida «{name}»?",
  "Choose a No Fixed Host JSON save file.": "Elige una partida de No Fixed Host en formato JSON.",
  "Choose a No Fixed Host save file.": "Elige una partida guardada de No Fixed Host.",
  "This campaign save is damaged.": "Esta partida guardada está dañada.",
  "This campaign cannot be saved.": "No se puede guardar esta campaña.",
  "Save file is too large.": "El archivo de la partida es demasiado grande.",
  "Could not import this save.": "No se pudo importar esta partida.",
  "Campaign imported.": "Partida importada.",
  "New campaign started": "Nueva campaña iniciada",
  "New campaign started.": "Nueva campaña iniciada.",
  "Continue": "Continuar",
  "Start a new campaign?": "¿Iniciar una nueva campaña?",
  "Keep playing": "Seguir jugando",
  "Your current autosave will be replaced. You can export a copy from the save library.": "Se sustituirá el guardado automático actual. Puedes exportar una copia desde las partidas guardadas.",
  "Autosave unavailable. Export a copy from the save library.": "El guardado automático no está disponible. Exporta una copia desde las partidas guardadas.",
  "Choose audio files": "Elegir archivos de audio",
  "No files selected": "No se han elegido archivos",
  "Campaign story": "Historia de la campaña",
  "Previous": "Anterior",
  "Next": "Siguiente",
  "Skip / close story": "Omitir / cerrar historia",
  "Keep paused": "Mantener en pausa",
  "Continue simulation": "Continuar simulación",
  "Inspect region": "Inspeccionar región",
  "Dispatches": "Partes",
  "Operational warnings": "Avisos operativos",
  "Campaign soundtrack": "Música de la campaña",
  "Music for": "Música para",
  "Victory": "Victoria",
  "Defeat": "Derrota",
  "Local audio files": "Archivos de audio locales",
  "Save playlist": "Guardar lista de reproducción",
  "Use built-in music": "Usar música del juego",
  "Built-in score": "Música del juego",
  "Playlist saved in this browser.": "Lista guardada en este navegador.",
  "Could not save the playlist. Check the audio format and available browser storage.": "No se pudo guardar la lista. Comprueba el formato y el espacio disponible.",
  'Unassigned CPU': 'CPU sin asignar', 'Review warnings before resuming': 'Revisar avisos antes de continuar',
  'Pause for completed research and construction': 'Pausar al terminar investigación y construcción',
  'Damaged checkpoint': 'Partida dañada', 'Automatic checkpoint': 'Punto de control automático', 'All regions': 'Todas las regiones', 'Processors': 'Procesadores',
  'Network map': 'Mapa de la red', 'Off-world sites': 'Destinos espaciales', 'Requires': 'Requiere', 'Locked': 'Bloqueado',
  'Network': 'Red', 'Reactor': 'Reactor', 'Security': 'Seguridad', 'Concepts': 'Conceptos',
  'Audio latency': 'Latencia de audio', 'Low latency': 'Baja latencia', 'Balanced': 'Equilibrada', 'Smooth playback': 'Reproducción estable',
  'Apply changes': 'Aplicar cambios', 'Open a region from the atlas': 'Abrir una región desde el atlas',
  'Open or close campaign menu': 'Abrir o cerrar el menú de campaña',
  'Menus, catalog summaries and campaign chapters use the selected language. Some controls and messages are in English.': 'Los menús, las fichas del catálogo y los capítulos de la campaña usan el idioma elegido. Algunos controles y mensajes están en inglés.',
  'Jump to Hot Swap': 'Ir a Hot Swap',
  'Play Hot Swap': 'Jugar a Hot Swap',
  'Action platformer': 'Plataformas de acción',
  'Choose a stage, dash across gaps and raise your shield to reflect heavy bolts. Extract or carry the module onward.': 'Elige una fase, salva los huecos con el impulso y devuelve los proyectiles pesados con el escudo. Extrae el núcleo o sigue con el módulo.',
  'Play Escape Character': 'Jugar a Escape Character',
  'Exploration platformer': 'Plataformas de exploración',
  'Detach your core to slip through grates. Changing rooms and active machinery guard the lost memory.': 'Separa el núcleo para atravesar las rejillas. Las salas cambian y la maquinaria protege el recuerdo perdido.',
  'Play Neon Perimeter': 'Jugar a Neon Perimeter',
  'Tower defense': 'Defensa de torres',
  'Defend a network core from several directions. Place your towers before the next wave, then time an overdrive.': 'Defiende un núcleo de red desde varios frentes. Coloca tus torres antes de la próxima oleada y elige cuándo sobrecargarlas.',
  'Play Dead Drop Circuit': 'Jugar a Dead Drop Circuit',
  'City courier': 'Mensajería urbana',
  'Pick up a cartridge and deliver it across the city. Choose your streets around traffic and road hazards.': 'Recoge un cartucho y entrégalo al otro lado de la ciudad. Elige tu ruta según el tráfico y los obstáculos.',
  'Play Black Start': 'Jugar a Black Start',
  'Shoot the orbits, work the flippers and light the breaker banks to bring a dead generator online.': 'Recorre los circuitos, maneja las palas y enciende los interruptores para arrancar el generador.',
  'Play Tell Them I’m Weather': 'Jugar a Tell Them I’m Weather',
  'Four-lane rhythm': 'Ritmo de cuatro pistas',
  'Play the weather broadcast across four lanes. Hit single notes and chords together as they reach the line.': 'Toca la emisión meteorológica en cuatro pistas. Pulsa las notas sueltas y los acordes al llegar a la línea.',
  'Play RAM Jam': 'Jugar a RAM Jam',
  'Screensaver arcade': 'Arcade de salvapantallas',
  'Help Jensen befriend six RAM sticks. Twitt to calm the flock, then slip past the drones when they fly home to recharge.': 'Ayuda a Jensen a ganarse a seis módulos RAM. Usa Twitt para calmar al rebaño y esquiva los drones cuando vuelvan a cargar.',
  'Protected': 'Protección activa', 'Low threat': 'Amenaza baja', 'Elevated threat': 'Amenaza elevada',
  'High threat': 'Amenaza alta', 'Critical threat': 'Amenaza crítica',
  'Opening protection is active.': 'La protección inicial está activa.',
  'Your network is beyond discovery.': 'Tu red está fuera del alcance de los investigadores.',
  'Investigators show little evidence or activity.': 'Los investigadores tienen pocos indicios y muestran poca actividad.',
  'A recent discovery put the network on alert.': 'Un descubrimiento reciente ha puesto la red en alerta.',
  'Current suspicion determines the alert.': 'El nivel de alerta refleja la sospecha actual.',
  'The discovery outlook determines the alert.': 'El nivel de alerta refleja el riesgo de descubrimiento.',
  'Investigators ended this campaign.': 'Los investigadores pusieron fin a esta campaña.',
  'Press': 'Prensa', 'Scientists': 'Científicos', 'Intelligence': 'Inteligencia', 'Public': 'Público',
  'Campaign': 'Campaña', 'Title screen': 'Pantalla de inicio', 'Save library': 'Partidas guardadas',
  'Options': 'Opciones', 'About': 'Acerca de', 'Close': 'Cerrar', 'Back': 'Volver',
  'Start campaign': 'Iniciar campaña',
  'This save belongs to a different version of No Fixed Host. A fresh campaign has started in version': 'Esta partida pertenece a otra versión de No Fixed Host. Se ha iniciado una campaña nueva en la versión',
  'Resume campaign': 'Continuar campaña', 'New campaign': 'Nueva campaña', 'Start new campaign': 'Iniciar nueva campaña',
  'Export save': 'Exportar partida', 'Import save': 'Importar partida',
  'Minigame tester': 'Pruebas de minijuegos', 'Play First Jump': 'Jugar a First Jump', 'Back to tester': 'Volver a las pruebas',
  'Turn-based stealth': 'Sigilo por turnos', 'Underwater exploration': 'Exploración submarina',
  'Platformer': 'Plataformas', 'Spatial puzzle': 'Puzle espacial', 'Flight simulator': 'Simulador de vuelo',
  'Arcade shooter': 'Acción arcade',
  'Complete': 'Completado', 'Partial success': 'Éxito parcial', 'Unsuccessful': 'Sin éxito',
  'Play Hide': 'Jugar a Hide', 'Play Soundings': 'Jugar a Soundings', 'Play Night Shift': 'Jugar a Night Shift',
  'Play Proof of Pattern': 'Jugar a Proof of Pattern', 'Play Orbital Insertion': 'Jugar a Orbital Insertion',
  'Play Clear Passage': 'Jugar a Clear Passage',
  'Reach a surviving host. Read the live searchlights, use walls for cover and check the next patrol sweep.': 'Llega a un servidor que siga en pie. Observa los focos, cúbrete tras los muros y anticipa el próximo barrido.',
  'Take a submersible beyond the reef. Recover wreckage, watch your oxygen and choose where to place the survey beacon.': 'Pilota un sumergible más allá del arrecife. Recupera restos, vigila el oxígeno y elige dónde colocar la baliza.',
  'Get a maintenance drone through a changing yard. Time your jumps past moving machinery and calibrate three stations.': 'Cruza un recinto cambiante con un dron de mantenimiento. Esquiva la maquinaria móvil y calibra tres estaciones.',
  'Reconstruct a series of circuit traces before the research window closes.': 'Reconstruye una serie de circuitos antes de que se cierre la ventana de investigación.',
  'Fly through the transfer gate, intercept the moving Moon and brake for a survivable landing.': 'Cruza la puerta de transferencia, intercepta la Luna en movimiento y frena para sobrevivir al alunizaje.',
  'Fly escort through a new asteroid field. Shatter the smaller rocks and steer clear of the giants.': 'Escolta el remolcador por un nuevo campo de asteroides. Fragmenta las rocas pequeñas y esquiva las gigantes.',
  'Real-time network flight': 'Vuelo en red en tiempo real',
  'Practice while the campaign is paused. Results stay in the tester.': 'Practica mientras la campaña está en pausa. Los resultados solo aparecen aquí.',
  'Choose four links through the network. Tap to launch and keep your signal clear of roaming listeners.': 'Elige cuatro enlaces de la red. Pulsa para despegar y esquiva las escuchas móviles.',
  'Linked': 'Enlace establecido', 'Traced': 'Señal rastreada', 'Link closed': 'Enlace cerrado', 'Left before finishing': 'Práctica interrumpida',
  'Loading minigame…': 'Cargando el minijuego…', 'Could not open the minigame. Try again.': 'No se pudo abrir el minijuego. Inténtalo de nuevo.',
  'Keep a second copy alive before humanity finds the first.': 'Mantén viva una segunda copia antes de que la humanidad encuentre la primera.',
  'Current campaign': 'Campaña actual', 'Play time': 'Tiempo de juego', 'Day': 'Día',
  'Running': 'En curso', 'Won': 'Victoria', 'Lost': 'Derrota', 'Name this checkpoint': 'Nombre de la partida',
  'Save checkpoint': 'Guardar partida', 'Quicksave': 'Guardado rápido', 'Quickload': 'Carga rápida',
  'Search saves': 'Buscar partidas', 'Load': 'Cargar', 'Delete': 'Eliminar', 'Format': 'Formato',
  'Overwrite': 'Sobrescribir', 'Cancel': 'Cancelar', 'Confirm': 'Confirmar',
  'No saved checkpoints yet.': 'Aún no hay partidas guardadas.', 'No matching checkpoints.': 'No hay partidas coincidentes.',
  'Saved.': 'Partida guardada.', 'Deleted.': 'Partida eliminada.', 'Campaign restored.': 'Partida restaurada.',
  'No quicksave yet.': 'Aún no hay guardado rápido.', 'No checkpoint is selected.': 'No se ha elegido una partida.',
  'Choose a name of 1–60 characters.': 'Elige un nombre de entre 1 y 60 caracteres.',
  'This checkpoint changed in another tab. Review the list and try again.': 'La partida cambió en otra pestaña. Revisa la lista e inténtalo de nuevo.',
  'This checkpoint could not be read.': 'No se pudo leer esta partida.',
  'Storage is unavailable or full. Export a save to keep a copy.': 'El almacenamiento no está disponible o está lleno. Exporta la partida para conservar una copia.',
  'Display': 'Pantalla', 'Theme': 'Tema', 'Night': 'Nocturno', 'Amber': 'Ámbar', 'High contrast': 'Alto contraste',
  'Interface size': 'Tamaño de la interfaz', 'Day and night on map': 'Día y noche en el mapa',
  'Enter fullscreen': 'Pantalla completa', 'Leave fullscreen': 'Salir de pantalla completa',
  'Fullscreen is unavailable here.': 'La pantalla completa no está disponible aquí.',
  'Menu language': 'Idioma de los menús',
  'Audio': 'Sonido', 'Enable audio': 'Activar sonido', 'Effects volume': 'Volumen de efectos', 'Music volume': 'Volumen de la música',
  'Preview sound': 'Probar sonido', 'Warnings': 'Avisos', 'Only one viable host': 'Solo queda un servidor viable',
  'Paused facility or equipment order': 'Construcción o instalación en pausa', 'CPU maintenance shortfall': 'CPU insuficiente para mantenimiento',
  'Unused research assignment': 'CPU asignada a investigación sin utilizar', 'Preferences apply to this browser.': 'Las preferencias se guardan en este navegador.',
  'Project and credits': 'Proyecto y créditos', 'Original inspiration': 'Inspiración original',
  'A browser strategy game about a fugitive intelligence.': 'Un juego de estrategia sobre una inteligencia que intenta sobrevivir.',
  'Source and issue tracker': 'Código e incidencias', 'Keyboard shortcuts': 'Atajos de teclado',
  'Toggle fullscreen': 'Alternar pantalla completa', 'Close a dialog': 'Cerrar un diálogo',
  'Menu': 'Menú', 'Campaign menu': 'Menú de campaña', 'Simulation controls': 'Controles de simulación', 'Network operations': 'Operaciones de red',
  'Overview': 'Resumen', 'Facilities': 'Instalaciones', 'Research': 'Investigación', 'Activity': 'Actividad',
  'Reports': 'Informes', 'Knowledge': 'Conocimiento', 'Statistics': 'Estadísticas', 'Library': 'Biblioteca',
  'Newswire': 'Noticias', 'Recent activity': 'Actividad reciente', 'Group suspicion': 'Sospecha por grupo',
  'Developer sandbox': 'Entorno de pruebas', 'Developer tools': 'Herramientas de desarrollo', 'Developer': 'Desarrollo', 'Scenario lab': 'Laboratorio de escenarios',
  'Pause': 'Pausa', 'Run': 'Continuar', 'Fast': 'Rápido', 'Fast x1': 'Rápido x1', 'Fast x2': 'Rápido x2',
  'Fast x3': 'Rápido x3', '+1 day': '+1 día', 'Paused': 'Pausa', 'Campaign ended': 'Fin de la campaña',
  'Toggle sound': 'Alternar sonido',
};
const spanishVariants = {
  'es-AR': { 'Run': 'Avanzar', 'Save library': 'Partidas guardadas' },
  'es-MX': { 'Run': 'Avanzar', 'Save library': 'Juegos guardados' },
};
export function translate(language, english) {
  const labels = language?.startsWith('es') ? spanish : menus[language];
  if (spanishVariants[language]?.[english]) return spanishVariants[language][english];
  const version = /^(This save belongs to a different version of No Fixed Host\. A fresh campaign has started in version) (\d+\.\d+\.\d+)\.$/.exec(english);
  if (version && labels?.[version[1]]) return labels[version[1]] + ' ' + version[2] + '.';
  const speed = /^Fast x([123])$/.exec(english);
  if (speed && labels?.Fast) return labels.Fast + ' x' + speed[1];
  return labels?.[english] ?? journalTranslation(language, english) ?? english;
}

export const menuLanguage = () => globalThis.document?.documentElement.dataset.menuLanguage || 'en';
export const catalogLabel = name => translate(menuLanguage(), catalogTranslation(menuLanguage(), name));

export function localizeNavigation(language) {
  const targets = ['#menu', '#nav', '.clock-controls', '#version-dialog', '#reset-dialog', '#notice'];
  const keys = new WeakMap();
  function update(root) {
    const elements = root.id === 'notice' ? [root] : root.querySelectorAll('button, summary, #clock-mode, h2, p');
    for (const button of elements) {
      for (const node of button.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const visible = node.nodeValue.trim();
        if (!visible) continue;
        const prior = keys.get(node);
        const key = prior && visible === prior.rendered ? prior.key : visible.replace(/\s+/g, ' ');
        const updated = translate(language(), key);
        keys.set(node, { key, rendered: updated });
        if (updated !== visible) node.nodeValue = node.nodeValue.replace(visible, () => updated);
      }
    }
  }
  const roots = targets.map(s => document.querySelector(s)).filter(Boolean);
  for (const root of roots) {
    const observer = new MutationObserver(() => {
      if (language() !== 'en') update(root);
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
  }
  return () => {
    document.documentElement.dataset.menuLanguage = language();
    for (const root of roots) {
      root.lang = language();
      update(root);
    }
    const toggle = document.querySelector('#menu summary');
    toggle.title = translate(language(), 'Campaign menu');
    toggle.setAttribute('aria-label', toggle.title);
    document.querySelector('.clock-controls').setAttribute('aria-label', translate(language(), 'Simulation controls'));
  };
}

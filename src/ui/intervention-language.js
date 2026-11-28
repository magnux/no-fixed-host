// Localized operations and journal entries share the same names for outcomes.
import { GROUPS, REGIONS } from '../game/content.js';
import { catalogTranslation } from './catalog-languages.js';

const phrases = {
  'Interventions': 'Intervenciones',
  'Public campaign': 'Campaña pública',
  'Independent study': 'Estudio independiente',
  'Investigations have ended.': 'Las investigaciones han finalizado.',
  'Respond to the open tip first.': 'Responde primero al aviso pendiente.',
  'Cooldown in progress.': 'Periodo de espera en curso.',
  'Insufficient funds.': 'Fondos insuficientes.',
  'Requires Media Manipulation.': 'Requiere Manipulación de medios.',
  'Available after opening protection.': 'Disponible al terminar la protección inicial.',
  'Select a Scientists discovery.': 'Selecciona un descubrimiento del grupo científico.',
  'Case already commissioned.': 'Este caso ya se ha encargado.',
  'For seven nights, the nightly decay rate for remaining Public evidence rises by two percentage points (2% to 4% before Memetics).': 'Durante siete noches, la tasa de reducción nocturna de las pruebas que conserva el público aumenta dos puntos porcentuales (del 2 % al 4 % antes de Memética).',
  'There is a 20% chance that the Press or Intelligence traces the sponsor and gains 3 evidence points.': 'Hay un 20 % de probabilidades de que la prensa o los servicios de inteligencia identifiquen al patrocinador y sumen 3 puntos de pruebas.',
  'Commission a lab to revisit one Scientists discovery. Results arrive in seven days. Each case can be reviewed once.':
    'Encarga a un laboratorio que revise un descubrimiento científico. El resultado llega en siete días. Cada caso admite una revisión.',
  'For 14 days in that region, the Scientists’ discovery rate may fall 25% (50% chance), stay level (30%), or rise 25% (20%).':
    'Durante 14 días en esa región, la tasa de descubrimiento científico puede bajar un 25 % (probabilidad del 50 %), mantenerse (30 %) o subir un 25 % (20 %).',
  'One launch every 30 game days.': 'Una campaña cada 30 días de juego.',
  'One commission every 30 game days.': 'Un encargo cada 30 días de juego.',
  'Launch campaign': 'Lanzar campaña', 'Commission study': 'Encargar estudio',
  'Witness tips': 'Avisos de testigos', 'Next tip possible': 'Próximo aviso posible',
  'When one urban host draws a lone observer, you may get a tip before the report is filed. A payoff costs 10% of the host’s replacement value, with a $1,000 minimum. Offers can appear at most once every seven days.':
    'Si un único testigo detecta un nodo urbano, puede llegar un aviso antes de que presente el informe. El pago cuesta el 10 % del valor de reposición del nodo, con un mínimo de 1000 dólares. Como máximo se recibe una oferta cada siete días.',
  'Case to review': 'Caso que revisar', 'No unreviewed Scientists cases': 'No hay casos científicos pendientes de revisión',
  'Campaign ends': 'Fin de la campaña', 'Report due': 'Publicación prevista',
  'Next launch': 'Próxima campaña', 'Next commission': 'Próximo encargo',
  'Funds after payment': 'Saldo tras el pago', 'Insufficient funds': 'Fondos insuficientes',
  'Explained': 'Explicación ordinaria', 'Inconclusive': 'Resultado no concluyente', 'Corroborated': 'Avistamiento corroborado',
  'Effect ends': 'Fin del efecto', 'Witness tip': 'Aviso de un testigo', 'An observer has a lead': 'Un testigo tiene un indicio',
  'A lone observer can still withhold this report. Letting it through triggers an ordinary discovery.':
    'Un único testigo aún puede guardar silencio. Si presenta el informe, se producirá un descubrimiento ordinario.',
  'A payoff has a 60% chance of saving this host. Refusal loses the fee and the host, and adds 2 evidence points to Intelligence.':
    'El pago tiene un 60 % de probabilidades de salvar este nodo. Si lo rechaza, perderás el dinero y el nodo, y los servicios de inteligencia sumarán 2 puntos de pruebas.',
  'Pay observer': 'Pagar al testigo', 'Let the report through': 'Dejar que presente el informe',
  'Activity log': 'Registro de actividad',
};

export const interventionText = (message, language) => language === 'es' ? phrases[message] ?? message : message;

export function interventionDispatch(event, language) {
  if (language !== 'es') return null;
  const region = catalogTranslation(language, REGIONS[event.region]?.name || '');
  const group = catalogTranslation(language, GROUPS[event.group]?.name || '');
  switch (event.kind) {
    case 'news.campaign': return { headline: 'Campaña pública en marcha', text: 'La campaña acelera el descenso de las pruebas del público durante siete noches.' };
    case 'news.expose': return { headline: 'El patrocinador queda al descubierto', text: group + ' ha identificado al patrocinador y suma tres puntos de pruebas.' };
    case 'news.study': return { headline: 'Estudio científico encargado', text: 'El laboratorio volverá a examinar el caso de ' + region + '. El informe se publicará en siete días.' };
    case 'news.replication': {
      const result = { explained: 'El laboratorio ha identificado una explicación ordinaria. La tasa de descubrimiento científico baja un 25 % durante 14 días.',
        corroborated: 'El laboratorio ha corroborado el indicio. La tasa de descubrimiento científico sube un 25 % durante 14 días.',
        inconclusive: 'El resultado no es concluyente. La tasa de descubrimiento científico sigue igual.' };
      return { headline: 'Informe científico de ' + region, text: result[event.outcome] ?? event.text };
    }
    case 'news.tip': return { headline: 'Un testigo tiene un indicio', text: (event.siteName || region) + '. El testigo todavía no ha presentado el informe.' };
    case 'news.tip-result': {
      const result = { accepted: 'El testigo aceptó el pago y el nodo sigue en línea.', refused: 'El testigo rechazó el pago y presentó el informe. Los servicios de inteligencia suman dos puntos adicionales.',
        declined: 'El testigo presentó su informe. El descubrimiento sigue su curso.' };
      return { headline: 'Decisión sobre el aviso en ' + region, text: result[event.outcome] ?? event.text };
    }
    default: return null;
  }
}

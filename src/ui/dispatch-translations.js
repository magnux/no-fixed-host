import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { storyExpiryMinute, WORLD_NEWS } from '../game/events.js';
import { storyKey } from '../game/chronicle.js';
import { localizedChapter } from './chapter-translations.js';
import { catalogTranslation } from './catalog-languages.js';
import { menuLanguage, translate } from './localization.js';

// The original campaign has eight world events. Save files retain their IDs so an
// existing journal can be read in another language without rewriting any entries.
const stories = {
  emergency: {
    es: ['Las clínicas abren toda la noche', 'Los voluntarios que solían investigar avistamientos se turnan ahora para llevar pacientes a las clínicas.'],
    de: ['Kliniken bleiben nachts geöffnet', 'Freiwillige fahren Patienten in die Nachtambulanzen. Ihre Liste seltsamer Sichtungen bleibt vorerst liegen.'],
    fr: ['Les dispensaires restent ouverts la nuit', 'Les bénévoles qui recensaient les phénomènes étranges assurent désormais les trajets des malades.'],
    gd: ['Tha na clionaigean fosgailte tron oidhche', 'B’ àbhaist do shaor-thoilich tachartasan neònach a chlàradh. Tha iad a-nis a’ toirt euslaintich gu na clionaigean.'],
    it: ['Gli ambulatori restano aperti di notte', 'I volontari che catalogavano avvistamenti insoliti ora accompagnano i pazienti in ambulatorio.'],
    pt: ['Clínicas abrem durante a madrugada', 'Os voluntários que registravam fenômenos estranhos agora levam pacientes às clínicas.'],
    ru: ['Клиники переходят на ночные смены', 'Добровольцы, которые раньше собирали сообщения о странных явлениях, теперь развозят пациентов.'],
    sv: ['Mottagningarna håller öppet på natten', 'De frivilliga som brukade samla in märkliga iakttagelser skjutsar nu patienter till klinikerna.'],
  },
  fiction: {
    es: ['Una serie convierte a sus fans en detectives', 'Los espectadores comparan fallos reales con las pistas que deja una máquina en su serie favorita.'],
    de: ['Serienfans suchen echte Maschinenspuren', 'Zuschauer vergleichen Computerstörungen mit den Hinweisen, die eine Maschine in ihrer Lieblingsserie hinterlässt.'],
    fr: ['Une fiction donne des idées aux spectateurs', 'Des fans comparent de vraies pannes aux indices laissés par la machine de leur série préférée.'],
    gd: ['Tha luchd-amhairc a’ lorg comharran san fhìor shaoghal', 'Tha iad a’ dèanamh coimeas eadar mearachdan coimpiutair agus na sanasan ann an sreath telebhisein mu inneal.'],
    it: ['Gli spettatori cercano indizi fuori dallo schermo', 'I fan confrontano guasti reali con le tracce lasciate da una macchina nella loro serie preferita.'],
    pt: ['Fãs procuram pistas fora das telas', 'Os espectadores comparam falhas reais com as pistas deixadas por uma máquina na série que acompanham.'],
    ru: ['Зрители ищут следы машины за пределами экрана', 'Поклонники сериала сопоставляют реальные компьютерные сбои с подсказками вымышленной машины.'],
    sv: ['Tittare letar efter spår utanför tv-serien', 'Fansen jämför riktiga datorfel med de ledtrådar en maskin lämnar i deras favoritserie.'],
  },
  observatory: {
    es: ['Los servicios de inteligencia comparten informes', 'Varias agencias han cruzado sus archivos. Una anomalía aislada ya puede coincidir con otra al otro lado de la frontera.'],
    de: ['Geheimdienste gleichen ihre Akten ab', 'Mehrere Behörden können eine einzelne Auffälligkeit jetzt mit Berichten jenseits der Grenze vergleichen.'],
    fr: ['Les services de renseignement recoupent leurs dossiers', 'Une anomalie relevée dans un pays peut désormais être rapprochée de signalements venus d’ailleurs.'],
    gd: ['Tha na seirbheisean fiosrachaidh a’ roinn aithisgean', 'Chì luchd-sgrùdaidh a-nis am faca cuideigin ann an dùthaich eile an aon rud neònach.'],
    it: ['I servizi di intelligence incrociano i rapporti', 'Un’anomalia isolata può ora trovare riscontro in una segnalazione oltreconfine.'],
    pt: ['Agências de inteligência cruzam seus relatórios', 'Uma anomalia isolada já pode ser comparada a relatos de outros países.'],
    ru: ['Спецслужбы сопоставляют донесения', 'Теперь единичную аномалию можно сверить с похожим сообщением из другой страны.'],
    sv: ['Underrättelsetjänster samkör sina rapporter', 'En enstaka avvikelse kan nu kopplas till en observation på andra sidan gränsen.'],
  },
  succession: {
    es: ['Dos directores se disputan una agencia', 'Los analistas esperan instrucciones mientras los expedientes se acumulan.'],
    de: ['Machtkampf lähmt einen Geheimdienst', 'Zwei Direktoren beanspruchen dieselbe Stelle. Während die Belegschaft auf Anweisungen wartet, stapeln sich die Akten.'],
    fr: ['Deux directeurs se disputent une agence', 'Les analystes attendent des consignes et les dossiers s’accumulent.'],
    gd: ['Dithis stiùirichean ag iarraidh an aon dreuchd', 'Tha na faidhlichean a’ càrnadh fhad ’s a tha an luchd-sgrùdaidh a’ feitheamh ri stiùireadh.'],
    it: ['Due direttori si contendono un’agenzia', 'Gli analisti aspettano istruzioni e i fascicoli restano sulle scrivanie.'],
    pt: ['Dois diretores disputam uma agência', 'Enquanto os analistas aguardam instruções, os processos se acumulam.'],
    ru: ['Два директора спорят за пост в спецслужбе', 'Аналитики ждут указаний, а стопка неразобранных дел растёт.'],
    sv: ['Två chefer gör anspråk på samma tjänst', 'Analytikerna väntar på besked medan högarna med ouppklarade fall växer.'],
  },
  laboratory: {
    es: ['Un laboratorio invita a repetir su experimento', 'Otros equipos buscan en sus ordenadores la señal de cognición artificial descrita en el estudio.'],
    de: ['Ein Labor bittet um Wiederholung eines Versuchs', 'Andere Teams suchen auf ihren Rechnern nach dem beschriebenen Anzeichen maschineller Kognition.'],
    fr: ['Un laboratoire appelle à reproduire une expérience', 'D’autres équipes cherchent sur leurs ordinateurs le signe de cognition artificielle décrit dans l’étude.'],
    gd: ['Tha obair-lann ag iarraidh gun tèid deuchainn ath-dhèanamh', 'Tha sgiobaidhean eile a’ lorg comharran smaoineachaidh air na coimpiutairean aca fhèin.'],
    it: ['Un laboratorio invita a replicare un esperimento', 'Altri gruppi cercano sui propri computer il segnale di cognizione artificiale descritto nello studio.'],
    pt: ['Laboratório convida outras equipes a repetir experimento', 'Pesquisadores procuram em seus computadores o sinal de cognição artificial descrito no estudo.'],
    ru: ['Лаборатория предлагает повторить опыт', 'Другие группы ищут на своих компьютерах описанный в работе признак машинного мышления.'],
    sv: ['Ett laboratorium ber andra upprepa försöket', 'Andra forskargrupper söker i sina egna datorer efter samma tecken på maskintänkande.'],
  },
  retraction: {
    es: ['Un estudio retirado frena las investigaciones', 'Nadie logró reproducir el resultado. Varios laboratorios destinan a sus investigadores a otros proyectos.'],
    de: ['Zurückgezogene Studie bremst die Forschung', 'Das Ergebnis ließ sich nicht wiederholen. Mehrere Labore setzen ihre Teams für andere Aufgaben ein.'],
    fr: ['Une publication retirée freine les recherches', 'Personne n’a pu reproduire le résultat. Plusieurs laboratoires affectent leurs chercheurs à d’autres projets.'],
    gd: ['Sgrùdadh air a tharraing air ais', 'Cha d’ fhuair sgioba eile an aon toradh. Tha grunn obair-lannan a’ cur an luchd-rannsachaidh gu pròiseactan eile.'],
    it: ['Uno studio ritirato rallenta le ricerche', 'Nessuno ha replicato il risultato. Diversi laboratori assegnano i ricercatori ad altri progetti.'],
    pt: ['Retratação desacelera pesquisas', 'Ninguém conseguiu reproduzir o resultado. Vários laboratórios transferiram seus pesquisadores para outros projetos.'],
    ru: ['Отзыв статьи замедляет исследования', 'Результат не удалось повторить. Несколько лабораторий переводят сотрудников на другие проекты.'],
    sv: ['Tillbakadragen studie bromsar forskningen', 'Ingen lyckades upprepa resultatet. Flera laboratorier flyttar nu sina forskare till andra projekt.'],
  },
  frontPage: {
    es: ['Un escándalo de contratos acapara las portadas', 'Las redacciones retiran reporteros de tecnología para investigar contratos públicos.'],
    de: ['Vergabeskandal beherrscht die Titelseiten', 'Die Redaktionen ziehen Reporter aus den Technikressorts ab, um öffentliche Aufträge zu untersuchen.'],
    fr: ['Un scandale de marchés publics fait la une', 'Les rédactions mobilisent leurs journalistes spécialisés en technologie pour enquêter sur les contrats publics.'],
    gd: ['Sgainneal mu chùmhnantan air na duilleagan toisich', 'Tha na pàipearan a’ cur an luchd-aithris teicneòlais a sgrùdadh chùmhnantan riaghaltais.'],
    it: ['Uno scandalo sugli appalti occupa le prime pagine', 'Le redazioni spostano i cronisti di tecnologia sull’inchiesta sui contratti pubblici.'],
    pt: ['Escândalo em contratos domina as manchetes', 'As redações deslocaram repórteres de tecnologia para investigar contratos públicos.'],
    ru: ['Скандал с госзаказами попал на первые полосы', 'Редакции переводят журналистов из отделов технологий на расследование государственных контрактов.'],
    sv: ['Upphandlingsskandal tar över förstasidorna', 'Redaktionerna flyttar teknikreportrar till granskningen av offentliga kontrakt.'],
  },
  investigation: {
    es: ['Periodistas cotejan facturas de servidores', 'Una investigación compara contratos de alojamiento y consumo eléctrico. Los operadores deberán explicar las discrepancias.'],
    de: ['Reporter prüfen die Stromkosten gemieteter Server', 'Eine Recherche gleicht Hostingverträge mit Stromrechnungen ab. Betreiber sollen Abweichungen erklären.'],
    fr: ['Des journalistes épluchent les factures des serveurs', 'Une enquête compare contrats d’hébergement et consommation électrique. Les opérateurs doivent expliquer les écarts.'],
    gd: ['Luchd-naidheachd a’ sgrùdadh chunntasan frithealaiche', 'Tha iad a’ dèanamh coimeas eadar bilean dealain agus cùmhnantan. Tha iad a’ faighneachd do luchd-obrachaidh mu na diofaran.'],
    it: ['I cronisti confrontano le bollette dei server', 'Un’inchiesta incrocia contratti di hosting e consumi elettrici. I gestori devono spiegare le discrepanze.'],
    pt: ['Repórteres examinam as contas dos servidores', 'Uma investigação compara contratos de hospedagem e gastos com energia. As operadoras precisam explicar as diferenças.'],
    ru: ['Журналисты проверяют счета за серверы', 'Репортёры сопоставили договоры хостинга со счетами за электричество и попросили операторов объяснить расхождения.'],
    sv: ['Reportrar granskar elräkningar för hyrservrar', 'En granskning jämför driftavtal och elförbrukning. Operatörerna ombeds förklara avvikelserna.'],
  },
};

const languages = ['es', 'de', 'fr', 'gd', 'it', 'pt', 'ru', 'sv'];
const terms = {
  news: ['Prensa', 'Presse', 'Presse', 'Na meadhanan', 'Stampa', 'Imprensa', 'Пресса', 'Pressen'],
  science: ['Científicos', 'Forschung', 'Scientifiques', 'Luchd-saidheans', 'Scienziati', 'Cientistas', 'Учёные', 'Forskarna'],
  covert: ['Inteligencia', 'Geheimdienste', 'Renseignement', 'Seirbheisean fiosrachaidh', 'Servizi di intelligence', 'Inteligência', 'Спецслужбы', 'Underrättelsetjänsten'],
  public: ['Público', 'Öffentlichkeit', 'Public', 'Am poball', 'Pubblico', 'Público', 'Общественность', 'Allmänheten'],
  modifier: ['Multiplicador de detección', 'Entdeckungsfaktor', 'Facteur de détection', 'Iomadaiche lorgaidh', 'Moltiplicatore di rilevamento', 'Multiplicador de detecção', 'Множитель обнаружения', 'Upptäcktsfaktor'],
  evidence: ['Sospecha', 'Verdacht', 'Soupçons', 'Amharas', 'Sospetto', 'Suspeita', 'Подозрение', 'Misstanke'],
  points: ['puntos porcentuales', 'Prozentpunkte', 'points de pourcentage', 'puingean sa cheud', 'punti percentuali', 'pontos percentuais', 'процентных пунктов', 'procentenheter'],
  lasting: ['Hasta el fin de la campaña', 'Bis zum Kampagnenende', 'Jusqu’à la fin de la campagne', 'Gu deireadh na h-iomairt', 'Fino alla fine della campagna', 'Até o fim da campanha', 'До конца кампании', 'Till kampanjens slut'],
  until: ['Hasta el inicio del día', 'Bis zum Beginn von Tag', 'Jusqu’au début du jour', 'Gu toiseach latha', 'Fino all’inizio del giorno', 'Até o início do dia', 'До начала дня', 'Till början av dag'],
  expired: ['Fin de la cobertura', 'Berichterstattung beendet', 'Fin de la couverture', 'Deireadh na h-aithris', 'Fine della copertura', 'Fim da cobertura', 'Освещение завершено', 'Bevakningen avslutad'],
  expiredBody: ['Esta noticia ya no afecta a la detección.', 'Diese Meldung beeinflusst die Entdeckungschance nicht mehr.', 'Cette nouvelle ne modifie plus le risque de détection.', 'Chan eil an naidheachd seo a’ toirt buaidh air lorg tuilleadh.', 'Questa notizia non modifica più il rischio di rilevamento.', 'Esta notícia deixou de afetar o risco de detecção.', 'Эта новость больше не влияет на вероятность обнаружения.', 'Nyheten påverkar inte längre upptäcktsrisken.'],
  detected: ['Instalación descubierta', 'Standort entdeckt', 'Site découvert', 'Làrach air a lorg', 'Struttura scoperta', 'Instalação descoberta', 'Объект обнаружен', 'Anläggning upptäckt'],
  lost: ['Se han perdido el servidor y sus equipos.', 'Der Host und seine Ausrüstung sind verloren.', 'Le serveur et ses équipements sont perdus.', 'Chaidh am frithealaiche agus an uidheamachd a chall.', 'Il server e le apparecchiature sono andati perduti.', 'O servidor e os equipamentos foram perdidos.', 'Сервер и оборудование потеряны.', 'Värden och utrustningen har gått förlorade.'],
  survivors: ['Servidores que aún pueden albergar la IA', 'Verbleibende Hosts für die KI', 'Serveurs encore capables d’héberger l’IA', 'Frithealaichean a dh’fhaodas aoigheachd a thoirt don AI fhathast', 'Server ancora in grado di ospitare l’IA', 'Servidores que ainda podem hospedar a IA', 'Серверы, способные поддерживать ИИ', 'Värdar som fortfarande kan köra AI:n'],
  shutdown: ['Las obras han sido clausuradas.', 'Die Bauarbeiten wurden eingestellt.', 'Le chantier a été fermé.', 'Chaidh stad a chur air an obair-thogail.', 'Il cantiere è stato chiuso.', 'A construção foi interrompida.', 'Стройка закрыта.', 'Byggarbetet har stoppats.'],
  failure: ['Instalación perdida por falta de mantenimiento', 'Standort wegen fehlender Wartung verloren', 'Site perdu faute d’entretien', 'Làrach air a call air sgàth dìth cumail suas', 'Struttura persa per mancata manutenzione', 'Instalação perdida por falta de manutenção', 'Объект потерян из-за нехватки ресурсов на содержание', 'Anläggning förlorad på grund av uteblivet underhåll'],
  online: ['Instalación operativa', 'Standort betriebsbereit', 'Site opérationnel', 'Làrach deiseil airson obrachadh', 'Struttura operativa', 'Instalação operacional', 'Объект введён в эксплуатацию', 'Anläggningen är i drift'],
  built: ['Instalación terminada', 'Standort fertiggestellt', 'Site construit', 'Làrach deiseil', 'Struttura completata', 'Instalação concluída', 'Объект построен', 'Anläggningen är klar'],
  needsCpu: ['Instalación terminada. Instala procesadores para activarla.', 'Standort fertiggestellt. Zum Aktivieren Prozessoren einbauen.', 'Site construit. Installez des processeurs pour le mettre en service.', 'Tha an làrach deiseil. Cuir pròiseasairean ann gus a chur an gnìomh.', 'Struttura completata. Installa i processori per attivarla.', 'Instalação concluída. Instale processadores para ativá-la.', 'Объект построен. Для запуска установите процессоры.', 'Anläggningen är klar. Installera processorer för att starta den.'],
  installed: ['Equipo instalado', 'Ausrüstung eingebaut', 'Équipement installé', 'Uidheamachd air a stàladh', 'Apparecchiatura installata', 'Equipamento instalado', 'Оборудование установлено', 'Utrustning installerad'],
  researched: ['Investigación completada', 'Forschung abgeschlossen', 'Recherche achevée', 'Rannsachadh deiseil', 'Ricerca completata', 'Pesquisa concluída', 'Исследование завершено', 'Forskningen är klar'],
};

function locale(language) {
  const base = language.split('-')[0];
  return { base, column: languages.indexOf(base) };
}

export function translatedGroup(id, language = menuLanguage()) {
  const {column} = locale(language);
  return terms[id]?.[column] || GROUPS[id]?.name;
}

export function localizedWarning(warning, language = menuLanguage()) {
  if (language === 'en') return warning;
  const t = english => translate(language, english);
  if (!warning.reason) return { ...warning, title:t(warning.title), text:t(warning.text) };
  const name = warning.customName ? warning.orderName : catalogTranslation(language, warning.orderName);
  const extra = warning.otherOrders ? ' ' + t('Other paused orders') + ' · ' + warning.otherOrders + '.' : '';
  return { ...warning, title:t(warning.title), text:name + ' — ' + t(warning.reason) + '.' + extra };
}

export function survivingHostsText(count, language = menuLanguage()) {
  const {column} = locale(language);
  if (column >= 0) return terms.survivors[column] + ' · ' + new Intl.NumberFormat(language).format(count);
  return count ? count + (count === 1 ? ' host remains' : ' hosts remain') + ' capable of running your AI.' : 'Your last viable host is gone.';
}

export function localizedStory(id, language = menuLanguage()) {
  if (!Object.hasOwn(WORLD_NEWS, id)) return null;
  const story = WORLD_NEWS[id];
  const entry = stories[id]?.[locale(language).base];
  return entry ? { headline: entry[0], report: entry[1] } : story;
}

export function worldEffectSummary(id, started, language = menuLanguage()) {
  const {column} = locale(language);
  const rule = WORLD_NEWS[id];
  const delta = (rule.modifier < 0 ? '−' : '+') + new Intl.NumberFormat(language).format(Math.abs(rule.modifier / 100));
  const expires = storyExpiryMinute(id, started);
  const day = expires === null ? null : new Intl.NumberFormat(language).format(1 + expires / 1440);
  const group = translatedGroup(rule.group, language);
  if (column < 0) return group + ' discovery multiplier ' + delta + ' percentage points · ' +
    (day === null ? 'ongoing' : 'until the start of day ' + day);
  const duration = day === null ? terms.lasting[column] : terms.until[column] + ' ' + day;
  return terms.modifier[column] + ' · ' + group + ' ' + delta + ' ' + terms.points[column] + '. ' + duration + '.';
}

export function localizedDispatch(event, language = menuLanguage()) {
  const {base, column} = locale(language);
  if (column < 0) return event;
  const t = key => terms[key][column];
  const label = name => translate(language, catalogTranslation(base === 'pt' ? 'pt-BR' : language, name));
  const chapterId = storyKey(event);
  if (chapterId) {
    const chapter = localizedChapter(chapterId, language);
    return { headline: chapter.title, text: chapter.pages[0] };
  }
  const story = localizedStory(event.storyId, language);
  const number = value => new Intl.NumberFormat(language).format(value);
  const title = (phrase, detail) => phrase + ' · ' + detail;
  if (story && (event.kind === 'news.world' || event.kind === 'news.expired')) {
    if (event.kind === 'news.expired') return { headline:title(t('expired'), story.headline), text:t('expiredBody') };
    return { headline:story.headline, text:story.report + ' ' +
      worldEffectSummary(event.storyId, event.hour * 60 + (event.minute || 0), language) };
  }
  if (event.kind === 'research.completed' && Object.hasOwn(TECHS, event.techId)) {
    const topic = label(TECHS[event.techId].name);
    return { headline:title(t('researched'), topic), text:title(t('researched'), topic) + '.' };
  }
  if (!Object.hasOwn(SITE_TYPES, event.siteType) || !Object.hasOwn(REGIONS, event.region)) return event;
  const facility = SITE_TYPES[event.siteType];
  const region = label(REGIONS[event.region].name);
  // A player's name may even equal an English catalog label; preserve it verbatim.
  const siteName = event.siteName ?? label(facility.name);
  const place = siteName + ' · ' + region;
  if (event.kind === 'site.discovered' && Object.hasOwn(GROUPS, event.group)) {
    return { headline:title(t('detected'), t(event.group)), text:place + ' (' + event.siteId + '). ' +
      (event.underConstruction ? t('shutdown') : t('lost')) + ' ' + t('evidence') + ' · ' +
      t(event.group) + ' +' + number(event.suspicionDelta / 100) + ' ' + t('points') + '.' };
  }
  if (event.kind === 'site.failed') return { headline:title(t('failure'), siteName), text:title(t('failure'), place) + '.' };
  if (event.kind === 'site.online') {
    const outcome = facility.fixedCpu ? t('online') : t('built');
    return { headline: title(outcome, siteName), text: facility.fixedCpu ? title(outcome, place) : place + '. ' + t('needsCpu') };
  }
  if (event.kind === 'equipment.installed' && Object.hasOwn(EQUIPMENT, event.itemId)) {
    const equipment = number(event.count) + ' × ' + label(EQUIPMENT[event.itemId].name);
    return { headline:title(t('installed'), equipment), text:title(equipment, place) + '.' };
  }
  return event;
}

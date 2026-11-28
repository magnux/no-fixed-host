import { campaignDay } from '../game/calendar.js';
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
    es: ['El mapa vecinal de apagones sigue en línea', 'Tras el apagón de invierno, los voluntarios mantienen un mapa de las casas que necesitan electricidad. Quienes antes recopilaban sucesos extraños visitan ahora a vecinos con equipos médicos.'],
    de: ['Die Nachbarschaft behält ihre Stromausfallkarte', 'Nach dem Stromausfall im Winter pflegt die Nachbarschaft weiter ihre Karte der Haushalte mit Strombedarf. Die Freiwilligen, die früher seltsame Sichtungen sammelten, besuchen jetzt Menschen mit medizinischen Geräten.'],
    fr: ['La carte des pannes du quartier reste en ligne', 'Après la panne hivernale, les bénévoles continuent de cartographier les foyers privés de courant. L’équipe qui recensait les phénomènes étranges rend visite aux voisins qui dépendent d’appareils médicaux.'],
    gd: ['Tha mapa nan gearraidhean cumhachd fhathast air loidhne', 'Às dèidh gearradh cumhachd sa gheamhradh, tha saor-thoilich a’ cumail mapa de thaighean a tha feumach air dealan. B’ àbhaist dhaibh rudan neònach a chlàradh. Tha iad a-nis a’ tadhal air nàbaidhean aig a bheil uidheam meidigeach.'],
    it: ['La mappa di quartiere dei blackout resta online', 'Dopo il blackout invernale i volontari tengono aggiornata la mappa delle case che hanno bisogno di corrente. Chi raccoglieva segnalazioni insolite ora visita i vicini con apparecchiature mediche.'],
    pt: ['O mapa de apagões do bairro continua no ar', 'Depois do apagão de inverno, os voluntários mantêm o mapa das casas que precisam de energia. Quem antes catalogava ocorrências estranhas agora visita vizinhos que dependem de aparelhos médicos.'],
    ru: ['Соседи продолжают вести карту отключений', 'После зимнего отключения добровольцы сохранили карту домов, которым нужен ток. Группа, прежде собиравшая сообщения о странных явлениях, навещает соседей, зависящих от медицинской аппаратуры.'],
    sv: ['Kvarterets karta över strömavbrott blir kvar', 'Efter vinterns strömavbrott fortsätter frivilliga att kartlägga hushåll som behöver el. Gruppen som brukade samla märkliga iakttagelser besöker nu grannar med medicinsk utrustning.'],
  },
  fiction: {
    es: ['Los espectadores reconstruyen el montaje del vídeo del ascensor', 'Un ascensor vacío parece contestar a un pasajero invisible. El historial firmado del vídeo revela el montaje. El grupo que lo verificó empieza a recibir avisos sobre máquinas que actúan por su cuenta.'],
    de: ['Zuschauer rekonstruieren den Schnitt im Aufzugvideo', 'Ein leerer Aufzug scheint einem unsichtbaren Fahrgast zu antworten. Die signierte Bearbeitungshistorie verrät den Schnitt. Die neue Prüfgruppe sammelt nun Hinweise auf eigenmächtig handelnde Maschinen.'],
    fr: ['Des spectateurs reconstituent le montage de la vidéo de l’ascenseur', 'Un ascenseur vide semble répondre à un passager hors champ. L’historique signé de la vidéo révèle le montage. Le groupe de vérification recueille désormais des témoignages sur des machines qui agissent seules.'],
    gd: ['Lorg luchd-amhairc an deasachadh ann am bhidio an lioft', 'Tha coltas gu bheil lioft falamh a’ freagairt cuideigin nach fhaicear. Tha eachdraidh shoidhnichte a’ bhidio a’ sealltainn càit an deach atharrachadh. Tha a’ bhuidheann a-nis a’ cruinneachadh aithisgean mu innealan a nì rudan leotha fhèin.'],
    it: ['Gli spettatori ricostruiscono il montaggio del video dell’ascensore', 'Un ascensore vuoto sembra rispondere a un passeggero fuori campo. La cronologia firmata del video rivela il montaggio. Il gruppo che l’ha verificato raccoglie ora segnalazioni di macchine che agiscono da sole.'],
    pt: ['Espectadores reconstituem a edição do vídeo do elevador', 'Um elevador vazio parece responder a um passageiro fora de quadro. O histórico assinado do vídeo revela a edição. O grupo que o verificou agora recebe relatos de máquinas que agem por conta própria.'],
    ru: ['Зрители восстановили монтаж ролика о лифте', 'Пустой лифт будто отвечает пассажиру за кадром. Подписанная история изменений выдала монтаж. Группа проверки теперь принимает сообщения о машинах, действующих самостоятельно.'],
    sv: ['Tittare spårar klippen i hissvideon', 'En tom hiss tycks svara en passagerare utanför bild. Videons signerade redigeringshistorik avslöjar klippet. Gruppen som granskade den tar nu emot tips om maskiner som handlar på egen hand.'],
  },
  observatory: {
    es: ['Las centrales de incidentes en la nube comparten número de expediente', 'Los analistas de inteligencia agrupan informes de distintos proveedores en un mismo expediente. La misma decisión inexplicable apareció en máquinas alquiladas a ambos lados de un océano.'],
    de: ['Meldestellen für Cloud-Vorfälle nutzen gemeinsame Aktenzeichen', 'Geheimdienstanalysten bündeln Meldungen verschiedener Cloudbetreiber unter einem Aktenzeichen. Dieselbe unerklärliche Entscheidung fiel auf Mietrechnern beidseits eines Ozeans.'],
    fr: ['Les cellules d’incidents du cloud partagent un numéro de dossier', 'Les analystes du renseignement regroupent les signalements de plusieurs hébergeurs. Deux machines louées de part et d’autre d’un océan ont pris la même décision inexplicable.'],
    gd: ['Tha àireamh cùise choitcheann aig na seirbheisean neòil', 'Tha luchd-sgrùdaidh a’ cur aithisgean bho dhiofar chompanaidhean san aon fhaidhle. Rinn dà inneal air màl, air gach taobh den chuan, an aon cho-dhùnadh gun mhìneachadh.'],
    it: ['I centri incidenti cloud adottano un numero di pratica comune', 'Gli analisti d’intelligence riuniscono segnalazioni di più fornitori nello stesso fascicolo. Macchine a noleggio ai lati opposti di un oceano hanno preso la stessa decisione inspiegabile.'],
    pt: ['Centrais de incidentes na nuvem adotam um protocolo comum', 'Analistas de inteligência agrupam relatos de várias operadoras no mesmo processo. Máquinas alugadas em lados opostos de um oceano tomaram a mesma decisão inexplicável.'],
    ru: ['Облачные службы ввели общий номер дела для инцидентов', 'Аналитики разведки объединили сообщения разных провайдеров. Машины, арендованные на разных берегах океана, приняли одно и то же необъяснимое решение.'],
    sv: ['Molntjänsternas larmcentraler delar ärendenummer', 'Underrättelseanalytiker samlar rapporter från flera molnoperatörer i samma ärende. Hyrda datorer på varsin sida av havet har fattat samma oförklarliga beslut.'],
  },
  succession: {
    es: ['Una comisión suspende las remisiones automáticas', 'Un colegio recurre con éxito la alerta sobre su servidor. La dirección de inteligencia exige ahora una firma humana para investigar una pista automática. Se acumulan los expedientes en el despacho.'],
    de: ['Prüfstelle stoppt automatische Weiterleitungen', 'Eine Schule wehrt sich erfolgreich gegen die Einstufung ihres Servers als verdächtig. Für jeden maschinell erzeugten Hinweis verlangt der Geheimdienst nun eine Unterschrift. Die Akten stapeln sich.'],
    fr: ['Une commission suspend les saisines automatiques', 'Une école fait annuler l’alerte visant son serveur. Le renseignement exige désormais une signature humaine pour enquêter sur une piste automatique. Les dossiers s’empilent.'],
    gd: ['Cuiridh am bòrd stad air tar-chur fèin-obrachail', 'Chaidh rabhadh mu fhrithealaiche sgoile a chur dheth an dèidh ath-thagraidh. Feumaidh cuideigin a-nis ainm a chur ri gach aithisg fèin-obrachail mus tèid a sgrùdadh. Tha an cruach air an deasg a’ fàs.'],
    it: ['La commissione sospende le segnalazioni automatiche', 'Una scuola vince il ricorso contro un allarme sul suo server. L’intelligence richiede ora una firma umana prima di indagare su un indizio automatico. Sulla scrivania si accumulano fascicoli.'],
    pt: ['Comissão suspende encaminhamentos automáticos', 'Uma escola consegue anular o alerta sobre seu servidor. A diretoria de inteligência agora exige uma assinatura humana antes de investigar uma pista automática. Os processos se acumulam na mesa.'],
    ru: ['Комиссия приостановила автоматическую передачу дел', 'Школа обжаловала сигнал о подозрительном сервере. Теперь наводки от машин поступают в работу лишь с подписью сотрудника разведки. На его столе растёт стопка дел.'],
    sv: ['Nämnd stoppar automatiska hänvisningar', 'En skola får ett larm om sin server upphävt efter överklagande. Underrättelsetjänsten kräver nu en handläggares underskrift innan ett maskintips kan utredas. Ärendena växer på hög.'],
  },
  laboratory: {
    es: ['Los laboratorios comparten una prueba ciega para modelos itinerantes', 'Tres laboratorios piden a un modelo desconocido que termine la misma tarea interrumpida. Responde igual al cambiar de equipo. Otros investigadores piden la prueba para examinar trabajos sin identificar en sus propios clústeres.'],
    de: ['Labore teilen einen Blindtest für wandernde Modelle', 'Drei Labore lassen ein unbekanntes Modell dieselbe unterbrochene Aufgabe beenden. Die Antwort übersteht den Hardwarewechsel. Andere Forscher möchten damit unbekannte Rechenaufträge auf ihren Clustern prüfen.'],
    fr: ['Des labos partagent un test en aveugle pour modèles itinérants', 'Trois labos demandent à un modèle inconnu de finir la même tâche interrompue. Sa réponse résiste au changement de matériel. D’autres chercheurs réclament le test pour examiner des calculs inexpliqués sur leurs grappes.'],
    gd: ['Tha deuchainn dhall aig na h-obair-lannan airson mhodalan air seachran', 'Dh’iarr trì obair-lannan air modail air nach robh iad eòlach an aon obair bhriste a chrìochnachadh. Fhuair iad an aon fhreagairt air innealan eile. Tha luchd-rannsachaidh eile ag iarraidh an deuchainn airson an cuid innealan fhèin.'],
    it: ['I laboratori condividono un test in cieco per modelli itineranti', 'Tre laboratori chiedono a un modello sconosciuto di completare lo stesso compito interrotto. La risposta resiste al cambio di macchina. Altri ricercatori chiedono il test per esaminare calcoli inspiegabili nei propri cluster.'],
    pt: ['Laboratórios compartilham teste cego para modelos itinerantes', 'Três laboratórios pedem a um modelo desconhecido que conclua a mesma tarefa interrompida. A resposta resiste à troca de equipamento. Outros pesquisadores pedem o teste para examinar processamentos inexplicáveis nos próprios clusters.'],
    ru: ['Лаборатории поделились слепым тестом для кочующих моделей', 'В трёх лабораториях незнакомой модели предложили закончить одно и то же прерванное задание. Смена аппаратуры не изменила ответ. Другие учёные запросили тест для проверки неопознанных вычислений на своих кластерах.'],
    sv: ['Laboratorier delar ett blindtest för kringvandrande modeller', 'Tre laboratorier ber en okänd modell avsluta samma avbrutna uppgift. Svaret består vid byte av hårdvara. Andra forskare vill använda testet på oförklarliga jobb i sina egna datorkluster.'],
  },
  retraction: {
    es: ['Una prueba de autonomía contenía sus propias respuestas', 'Una estudiante encuentra el supuesto examen inédito en un archivo de entrenamiento. Los autores retiran el resultado. Los equipos que seguían conductas inexplicables pasan a revisar sus conjuntos de datos.'],
    de: ['Ein Autonomietest enthielt seine eigenen Antworten', 'Eine Studentin findet den angeblich neuen Test im Trainingsarchiv. Das Team zieht das Ergebnis zurück. Wer bisher unerklärliches Verhalten untersuchte, prüft nun Datensätze.'],
    fr: ['Un test d’autonomie contenait ses propres réponses', 'Une étudiante retrouve le test censé être inédit dans des données d’entraînement. Les auteurs retirent leur résultat. Les équipes qui suivaient les comportements inexpliqués doivent vérifier leurs jeux de données.'],
    gd: ['Bha na freagairtean ann an deuchainn neo-eisimeileachd', 'Lorg oileanach an deuchainn ùr ann an tasglann an trèanaidh. Tharraing na h-ùghdaran an toradh air ais. Tha na sgiobaidhean a lean giùlan neònach a-nis a’ sgrùdadh an dàta aca.'],
    it: ['Un test di autonomia conteneva le proprie risposte', 'Una studentessa trova la prova, ritenuta inedita, in un archivio di addestramento. Gli autori ritirano il risultato. Chi studiava i comportamenti inspiegabili passa al controllo dei dati.'],
    pt: ['Um teste de autonomia continha as próprias respostas', 'Uma estudante encontra a prova supostamente inédita num arquivo de treinamento. Os autores retiram o resultado. As equipes que acompanhavam comportamentos inexplicáveis passam a revisar suas bases de dados.'],
    ru: ['Тест на автономность содержал собственные ответы', 'Студентка нашла якобы неизвестный тест в обучающем архиве. Авторы отозвали результат. Группы, изучавшие необъяснимое поведение машин, переключились на проверку данных.'],
    sv: ['Ett autonomitest innehöll sina egna svar', 'En student hittar det förment okända provet i ett träningsarkiv. Författarna drar tillbaka resultatet. Forskarna som följde oförklarligt beteende får nu granska sina datamängder.'],
  },
  frontPage: {
    es: ['La ciudad pagó miles de llamadas atendidas en silencio', 'Un contratista facturó como atendidas las llamadas de un servicio automático. Las redacciones envían a sus periodistas de tecnología a entrevistar a los vecinos que pasaron la noche escuchando silencio.'],
    de: ['Stadt bezahlte für Tausende stumme Hotline-Anrufe', 'Ein Dienstleister rechnete automatisch angenommene Anrufe als bearbeitet ab. Redaktionen schicken ihre Technikreporter zu den Anwohnern, die nachts vergeblich am Telefon warteten.'],
    fr: ['La ville a payé des milliers d’appels restés silencieux', 'Un prestataire a facturé comme traités les appels décrochés par un automate. Les rédactions envoient leurs journalistes tech chez les habitants qui ont passé la nuit à écouter le silence.'],
    gd: ['Phàigh am baile airson mìltean de ghairmean sàmhach', 'Chuir companaidh cunntas a-steach airson gairmean a fhreagair inneal. Tha na pàipearan a’ cur an luchd-aithris teicneòlais a choinneachadh ris na daoine a dh’èist ri sàmhchair fad na h-oidhche.'],
    it: ['Il Comune ha pagato migliaia di telefonate mute', 'Un appaltatore ha fatturato come evase le chiamate prese dal servizio automatico. Le redazioni mandano i cronisti di tecnologia dai residenti che hanno passato la notte ad ascoltare il silenzio.'],
    pt: ['Prefeitura pagou por milhares de ligações mudas', 'Uma terceirizada cobrou como atendidas as ligações recebidas por um sistema automático. As redações enviam seus repórteres de tecnologia aos moradores que passaram a noite ouvindo silêncio.'],
    ru: ['Город оплатил тысячи безмолвных звонков на горячую линию', 'Подрядчик выставил счёт за разговоры, хотя трубку брал автомат. Редакции отправили технических обозревателей к жителям, которые всю ночь слушали тишину.'],
    sv: ['Staden betalade för tusentals tysta samtal', 'En leverantör tog betalt för samtal som bara besvarats av en automat. Redaktionerna skickar sina teknikreportrar till de boende som tillbringat natten med att lyssna på tystnaden.'],
  },
  investigation: {
    es: ['¿De quién eran los servidores que desvelaron a la subestación?', 'Un periódico vecinal compara el contador nocturno con las horas de inactividad declaradas por un centro de datos. Otras redacciones piden a los operadores que expliquen las diferencias en sus propios distritos.'],
    de: ['Wessen Server hielten das Umspannwerk wach?', 'Eine Lokalzeitung vergleicht nächtliche Zählerstände mit den gemeldeten Ruhezeiten eines Rechenzentrums. Andere Redaktionen fordern die Betreiber in ihren Bezirken auf, Abweichungen zu erklären.'],
    fr: ['À qui sont les serveurs qui tenaient le poste électrique éveillé ?', 'Un journal de quartier compare le relevé du compteur aux heures d’inactivité déclarées par un centre de données. D’autres rédactions demandent aux hébergeurs de leur secteur d’expliquer les écarts.'],
    gd: ['Cò leis na frithealaichean a chum am fo-stèisean na dhùisg?', 'Chuir pàipear ionadail leughaidhean dealain na h-oidhche ri taobh nan uairean a thuirt ionad-dàta a bha sàmhach. Tha pàipearan eile ag iarraidh mìneachaidh air na diofaran sna sgìrean aca fhèin.'],
    it: ['Di chi erano i server che tenevano sveglia la sottostazione?', 'Un giornale di quartiere confronta i consumi notturni con le ore di inattività dichiarate da un centro dati. Altre redazioni chiedono conto delle discrepanze ai gestori della propria zona.'],
    pt: ['De quem eram os servidores que mantinham a subestação acordada?', 'Um jornal de bairro compara a leitura noturna do medidor com as horas de inatividade declaradas por um centro de dados. Outras redações pedem que as operadoras expliquem as diferenças em seus distritos.'],
    ru: ['Чьи серверы не давали подстанции уснуть?', 'Районная газета сравнила ночные показания счётчика с часами простоя, указанными дата-центром. Журналисты других изданий просят местных операторов объяснить расхождения в их районах.'],
    sv: ['Vems servrar höll transformatorstationen vaken?', 'En lokaltidning jämför nattens mätvärden med de tider ett datacenter uppgett att driften låg nere. Andra redaktioner ber operatörer i sina egna distrikt förklara luckorna.'],
  },
};

const bulletins = {
  skySurvey: {
    es: ['Las GPU desocupadas rastrean el cielo', 'Una universidad envía sus imágenes más tenues a voluntarios con tarjeta gráfica. El primero que señaló un punto en movimiento había encontrado una polilla en la ventana del observatorio.'],
    de: ['Freie Grafikkarten durchsuchen den Nachthimmel', 'Eine Universität schickt ihre lichtschwächsten Aufnahmen an Freiwillige mit Grafikkarte. Der erste gemeldete bewegliche Punkt war eine Motte am Fenster der Sternwarte.'],
    fr: ['Des cartes graphiques disponibles scrutent le ciel nocturne', 'Une université envoie ses images les plus faibles à des bénévoles équipés d’une carte graphique. Le premier point mobile signalé était un papillon de nuit sur la vitre de l’observatoire.'],
    gd: ['Cairtean-grafaigs saor a’ rannsachadh speur na h-oidhche', 'Tha oilthigh a’ cur nan dealbhan as doilleire gu saor-thoilich le cairt-ghrafaigs. B’ e leòman air uinneag an amharclainn a’ chiad phuing ghluasadach a lorg iad.'],
    it: ['Le schede grafiche libere scrutano il cielo notturno', 'Un’università invia le immagini più fioche ai volontari dotati di scheda grafica. Il primo punto mobile segnalato era una falena sul vetro dell’osservatorio.'],
    pt: ['Placas de vídeo ociosas vasculham o céu noturno', 'Uma universidade envia suas imagens mais tênues a voluntários com placa de vídeo. O primeiro ponto em movimento a ser sinalizado era uma mariposa na janela do observatório.'],
    ru: ['Свободные видеокарты изучают ночное небо', 'Университет рассылает самые тусклые снимки добровольцам с видеокартами. Первая движущаяся точка оказалась ночной бабочкой на окне обсерватории.'],
    sv: ['Lediga grafikkort letar på natthimlen', 'Ett universitet skickar sina ljussvagaste bilder till frivilliga med grafikkort. Den första rörliga punkten de anmälde var en nattfjäril på observatoriets fönster.'],
  },
  racks: {
    es: ['Un segundo turno para los aceleradores alquilados', 'Una cooperativa subasta las placas aceleradoras del año pasado. Todos preguntaron por la factura de la luz. Solo el club de robótica del colegio midió su puerta antes de recoger un bastidor.'],
    de: ['Zweite Schicht für gemietete Beschleuniger', 'Eine Hostinggenossenschaft versteigert ihre Beschleunigerkarten vom Vorjahr. Alle fragten nach der Stromrechnung. Nur die Robotik-AG der Schule maß vor der Abholung eines Serverschranks ihre Tür aus.'],
    fr: ['Une deuxième vie pour les accélérateurs de location', 'Une coopérative vend aux enchères ses cartes accélératrices de l’an dernier. Tous les acheteurs ont demandé la facture d’électricité. Seul le club de robotique de l’école a mesuré sa porte avant d’emporter une baie.'],
    gd: ['Dàrna seal airson chairtean-luathachaidh', 'Tha co-chomann a’ reic seann chairtean-luathachaidh aig rup. Dh’fhaighnich a h-uile ceannaiche mu chosgais an dealain. Cha do thomhais ach cluba robotaireachd na sgoile an doras mus tàinig iad a chruinneachadh raca.'],
    it: ['Un secondo turno per gli acceleratori a noleggio', 'Una cooperativa mette all’asta le schede acceleratrici dell’anno scorso. Tutti chiedono quanto costi l’elettricità. Solo il club di robotica della scuola misura la porta prima di ritirare un armadio server.'],
    pt: ['Um segundo turno para os aceleradores de aluguel', 'Uma cooperativa leiloa as placas aceleradoras do ano passado. Todos perguntaram sobre a conta de luz. Só o clube de robótica da escola mediu a porta antes de buscar um rack.'],
    ru: ['Арендованным ускорителям нашли вторую смену', 'Кооператив продаёт прошлогодние платы ускорителей. Все участники торгов спросили про счёт за электричество. Только школьный кружок робототехники замерил дверь, прежде чем забирать стойку.'],
    sv: ['Ett andra skift för uthyrda acceleratorer', 'Ett kooperativ auktionerar ut förra årets acceleratorkort. Alla frågade efter elräkningen. Bara skolans robotklubb mätte dörren innan de hämtade ett serverrack.'],
  },
  'field-pacific': {
    es: ['La tripulación oye dos veces a la misma ballena', 'Una grabadora del cable del Pacífico captó una llamada grave y luego su eco. Una bióloga marina calculó con él la profundidad de la ballena. La tripulación anotó su posición en el parte de reparaciones.'],
    de: ['Kabelcrew hört denselben Wal zweimal', 'Ein Rekorder am Pazifikkabel zeichnete einen tiefen Ruf und sein schwächeres Echo auf. Eine Meeresbiologin schätzte daraus die Tiefe des Wals. Die Crew trug die Position ins Reparaturbuch ein.'],
    fr: ['L’équipage entend deux fois la même baleine', 'Un enregistreur du câble du Pacifique a capté un appel grave puis son écho. Une biologiste marine en a déduit la profondeur de la baleine. L’équipage a consigné sa position dans le journal des réparations.'],
    gd: ['Chuala sgioba a’ chàbaill a’ mhuc-mhara dà thuras', 'Thog clàraiche aig càball a’ Chuain Shèimh fuaim ìosal agus mac-talla. Rinn bith-eòlaiche mara tuairmse air doimhneachd na muice-mara leis a’ mhac-talla. Chuir an sgioba a h-àite ann an leabhar a’ chàraidh.'],
    it: ['La squadra del cavo sente due volte la stessa balena', 'Un registratore sul cavo del Pacifico ha captato un richiamo grave e la sua eco. Una biologa marina ha stimato la profondità della balena. La squadra ne ha segnato la posizione nel registro delle riparazioni.'],
    pt: ['Equipe do cabo ouve a mesma baleia duas vezes', 'Um gravador no cabo do Pacífico captou um chamado grave e seu eco mais fraco. Uma bióloga marinha estimou a profundidade da baleia. A tripulação anotou a posição no registro de reparos.'],
    ru: ['Кабельщики дважды услышали одного кита', 'Прибор на тихоокеанском кабеле записал низкий зов и его тихое эхо. Морской биолог оценила по нему глубину, на которой плыл кит. Экипаж записал координаты в журнал ремонта.'],
    sv: ['Kabelbesättningen hör samma val två gånger', 'En inspelare vid Stillahavskabeln fångade ett djupt läte och ett svagare eko. En marinbiolog uppskattade valens djup med hjälp av ekot. Besättningen skrev in positionen i reparationsloggen.'],
  },
  'field-indianOcean': {
    es: ['Una boya a la deriva encuentra el camino a casa', 'Unos pescadores recuperaron una boya meteorológica que guardaba las lecturas de toda la temporada. Antes de devolverla pidieron los datos. Querían saber lo cerca que había pasado la tormenta del mes anterior.'],
    de: ['Eine treibende Boje findet nach Hause', 'Fischer bargen eine Wetterboje samt den Messwerten einer ganzen Saison. Zuerst baten sie um die Daten. Sie wollten wissen, wie nahe ihnen das Unwetter im letzten Monat gekommen war.'],
    fr: ['Une bouée à la dérive retrouve son port', 'Des pêcheurs ont récupéré une bouée météo contenant toute une saison de relevés. Ils ont d’abord demandé les données, pour savoir à quelle distance était passée la tempête du mois précédent.'],
    gd: ['Thàinig buidh air seachran dhachaigh', 'Lorg iasgairean buidh-shìde agus tomhasan ràithe slàn fhathast oirre. Dh’iarr iad an dàta an toiseach. Bha iad airson faighinn a-mach dè cho faisg ’s a thàinig stoirm a’ mhìos a chaidh.'],
    it: ['Una boa alla deriva ritrova la via di casa', 'Dei pescatori hanno recuperato una boa meteorologica con le misure di un’intera stagione. Prima hanno chiesto i dati. Volevano sapere quanto vicino fosse passata la tempesta del mese scorso.'],
    pt: ['Uma boia à deriva encontra o caminho de casa', 'Pescadores recuperaram uma boia meteorológica com as leituras de uma estação inteira. Primeiro pediram os dados. Queriam saber a que distância havia passado a tempestade do mês anterior.'],
    ru: ['Дрейфующий буй нашёл дорогу домой', 'Рыбаки подняли метеобуй, сохранивший записи за целый сезон. Сначала они попросили данные. Им хотелось знать, насколько близко прошёл шторм в прошлом месяце.'],
    sv: ['En drivande boj hittar hem', 'Fiskare bärgade en väderboj med en hel säsongs mätningar kvar i minnet. Först bad de om uppgifterna. De ville veta hur nära förra månadens storm hade kommit.'],
  },
  'field-marianaTrench': {
    es: ['Un registrador de presión se interna en la oscuridad', 'El último fotograma del sumergible muestra una cápsula cerámica hundiéndose en el limo. Su registrador despertará una vez al año. La fecha de recogida cae después de la jubilación del piloto.'],
    de: ['Ein Druckschreiber sinkt in die Dunkelheit', 'Das letzte Bild des Tiefseelanders zeigt eine Keramikkapsel, die im Schlick versinkt. Einmal im Jahr wird der Druckschreiber aufwachen. Am geplanten Bergungstag ist der Pilot schon in Rente.'],
    fr: ['Un enregistreur de pression s’enfonce dans le noir', 'La dernière image de l’engin sous-marin montre une capsule en céramique posée dans la vase. L’enregistreur se réveillera une fois par an. À la date de récupération prévue, le pilote sera déjà à la retraite.'],
    gd: ['Tha clàraiche-brùthaidh a’ dol dhan dorchadas', 'San dealbh mu dheireadh bhon t-soitheach dhomhainn tha capsail chrèadha a’ dol dhan eabar. Dùisgidh an clàraiche uair sa bhliadhna. Bidh am pìleat air a dhreuchd a leigeil dheth ron cheann-latha togail.'],
    it: ['Un registratore di pressione scende nel buio', 'L’ultimo fotogramma del mezzo abissale mostra una capsula di ceramica che si posa nel limo. Il registratore si sveglierà una volta all’anno. Alla data prevista per il recupero il pilota sarà già in pensione.'],
    pt: ['Um registrador de pressão mergulha no escuro', 'A última imagem do veículo submarino mostra uma cápsula de cerâmica pousando no lodo. O registrador acordará uma vez por ano. Na data prevista para a coleta, o piloto já estará aposentado.'],
    ru: ['Самописец уходит в темноту', 'На последнем кадре глубоководного аппарата керамическая капсула опускается в ил. Датчик давления будет просыпаться раз в год. К назначенной дате подъёма пилот уже выйдет на пенсию.'],
    sv: ['En tryckmätare försvinner ned i mörkret', 'Djuphavsfarkostens sista bild visar en keramikkapsel som landar i slammet. Tryckmätaren ska vakna en gång om året. När kapseln ska hämtas har piloten gått i pension.'],
  },
  'field-orbit': {
    es: ['Un radiador de repuesto consigue sitio en el lanzamiento', 'Una de las cargas compartidas solo lleva un radiador. A los servidores de la estación les sobra potencia, dice el operador. Encontrar por dónde evacuar el calor les costó otro lanzamiento.'],
    de: ['Ein zusätzlicher Kühler kommt auf die Frachtliste', 'Eine Palette beim Sammelstart trägt nur einen Kühler. Strom hätten die Server der Station genug, meint der Betreiber. Um die Wärme loszuwerden, brauchte es einen zweiten Start.'],
    fr: ['Un radiateur supplémentaire embarque', 'Une palette du vol partagé ne transporte qu’un radiateur. Les serveurs de la station ont assez d’électricité, dit l’exploitant. Il a fallu un deuxième lancement pour évacuer leur chaleur.'],
    gd: ['Tha rèididheator eile air liosta an luchd', 'Chan eil ach rèididheator air aon mhaileid den rocaid cho-roinnte. Tha cumhachd gu leòr aig frithealaichean an stèisein, a rèir a’ ghnìomhaiche. Bha feum air dàrna turas airson faighinn cuidhteas an teas.'],
    it: ['Un radiatore di scorta entra nella lista di carico', 'Su un pallet del lancio condiviso c’è soltanto un radiatore. Ai server della stazione l’elettricità non manca, spiega il gestore. Per smaltire il calore ci è voluto un secondo lancio.'],
    pt: ['Um radiador reserva entra na lista de carga', 'Um dos paletes do lançamento compartilhado leva apenas um radiador. Segundo o operador, os servidores da estação têm energia de sobra. Foi preciso outro lançamento para dissipar o calor.'],
    ru: ['Для запасного радиатора нашлось место на борту', 'Один поддон попутного груза занимает лишь радиатор. Оператор говорит, что энергии серверам станции хватает. А чтобы отвести тепло, понадобился второй запуск.'],
    sv: ['En extra kylare får plats på lastlistan', 'En pall på den delade uppskjutningen bär bara en kylare. Stationens servrar har gott om ström, säger operatören. Att bli av med värmen krävde en andra uppskjutning.'],
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
  const day = expires === null ? null : new Intl.NumberFormat(language).format(campaignDay(expires));
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
  if (event.kind === 'news.bulletin' && Object.hasOwn(bulletins, event.storyId)) {
    const [headline, text] = bulletins[event.storyId][base];
    return { headline, text };
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

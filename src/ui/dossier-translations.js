import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { KNOWLEDGE_ENTRIES, researchFindings } from '../game/knowledge.js';
import { catalogTranslation } from './catalog-languages.js';
import { translate } from './localization.js';
import { SAFETY_GUIDANCE } from '../game/research.js';

// Project effects and design figures come from the same records as the simulation.
// Only the words around those values vary by language.
const languages = ['es','de','fr','gd','it','pt-BR','ru','sv'];
const rows = [
  ['Standard funding','Coste estándar','Standardkosten','Coût standard','Cosgais bhunaiteach','Costo standard','Custo padrão','Базовая стоимость','Grundkostnad'],
  ['Funding','Financiación','Finanzierung','Financement','Maoineachadh','Finanziamento','Financiamento','Финансирование','Finansiering'],
  ['Compute work','Trabajo de cálculo','Rechenaufwand','Travail de calcul','Obair àireamhachaidh','Lavoro di calcolo','Trabalho computacional','Объём вычислений','Beräkningsarbete'],
  ['Standard duration','Duración estándar','Regelbauzeit','Durée standard','Ùine bhunaiteach','Durata standard','Duração padrão','Базовое время','Normaltid'],
  ['Minimum time','Tiempo mínimo','Mindestdauer','Durée minimale','Ùine as lugha','Tempo minimo','Tempo mínimo','Минимальное время','Minimitid'],
  ['Branch','Rama','Forschungszweig','Branche','Meur','Ramo','Ramo','Направление','Gren'],
  ['Research host','Host de investigación','Forschungsstandort','Site de recherche','Ionad rannsachaidh','Sede di ricerca','Local de pesquisa','Место исследования','Forskningsplats'],
  ['Processor bays','Bahías de procesadores','Prozessorplätze','Emplacements processeur','Àiteachan pròiseasair','Alloggiamenti CPU','Baias de processador','Места для процессоров','Processorplatser'],
  ['Fixed hardware','Hardware fijo','Feste Hardware','Matériel fixe','Bathar-cruaidh stèidhichte','Hardware fisso','Hardware fixo','Несменяемое оборудование','Fast utrustning'],
  ['Standard upkeep','Mantenimiento estándar','Regelunterhalt','Entretien standard','Cumail suas bunaiteach','Manutenzione standard','Manutenção padrão','Базовое содержание','Normalt underhåll'],
  ['Standard daily discovery risk','Riesgo diario de detección','Tägliches Entdeckungsrisiko','Risque journalier de détection','Cunnart lorgaidh làitheil','Rischio giornaliero di scoperta','Risco diário de descoberta','Суточный риск обнаружения','Daglig upptäcktsrisk'],
  ['Slot','Ranura','Steckplatz','Emplacement','Sliotan','Slot','Encaixe','Ячейка','Plats'],
  ['Processors','Procesadores','Prozessoren','Processeurs','Pròiseasairean','Processori','Processadores','Процессоры','Processorer'],
  ['Network','Red','Netzwerk','Réseau','Lìonra','Rete','Rede','Сеть','Nätverk'],
  ['Reactor','Reactor','Reaktor','Réacteur','Reactar','Reattore','Reator','Реактор','Reaktor'],
  ['Security','Seguridad','Sicherheit','Sécurité','Tèarainteachd','Sicurezza','Segurança','Охрана','Säkerhet'],
  ['Reachable locations','Regiones accesibles','Erreichbare Regionen','Régions accessibles','Roinnean ruigsinneach','Regioni raggiungibili','Regiões acessíveis','Доступные регионы','Tillgängliga regioner'],
  ['No compatible region reached yet','Aún no hay regiones compatibles','Noch keine geeignete Region erreicht','Aucune région compatible atteinte','Cha deach roinn fhreagarrach a ruigsinn fhathast','Nessuna regione compatibile raggiunta','Nenhuma região compatível alcançada','Подходящих регионов пока нет','Ingen lämplig region nådd ännu'],
  ['Identity & access','Identidad y acceso','Identität und Zugang','Identité et accès','Dearbh-aithne is inntrigeadh','Identità e accesso','Identidade e acesso','Идентификация и доступ','Identitet och åtkomst'],
  ['Society & influence','Sociedad e influencia','Gesellschaft und Einfluss','Société et influence','Comann is buaidh','Società e influenza','Sociedade e influência','Общество и влияние','Samhälle och inflytande'],
  ['Computing & networks','Cómputo y redes','Rechentechnik und Netze','Informatique et réseaux','Coimpiutaireachd is lìonraidhean','Calcolo e reti','Computação e redes','Вычисления и сети','Datorteknik och nätverk'],
  ['Engineering & power','Ingeniería y energía','Technik und Energie','Ingénierie et énergie','Innleadaireachd is cumhachd','Ingegneria ed energia','Engenharia e energia','Инженерия и энергетика','Teknik och energi'],
  ['Finance','Finanzas','Finanzen','Finance','Ionmhas','Finanza','Finanças','Финансы','Finans'],
  ['Space & physics','Espacio y física','Raumfahrt und Physik','Espace et physique','Fànas is fiosaigs','Spazio e fisica','Espaço e física','Космос и физика','Rymd och fysik'],
  ['Campaign','Campaña','Kampagne','Campagne','Iomairt','Campagna','Campanha','Кампания','Kampanj'],
  ['Required for','Requisito para','Voraussetzung für','Requis pour','Riatanach airson','Requisito per','Requisito para','Требуется для','Krävs för'],
  ['Requires','Requiere','Voraussetzungen','Prérequis','Feumar','Richiede','Requer','Требования','Kräver'],
  ['No prior research','Sin investigación previa','Keine Vorforschung','Aucune recherche préalable','Chan eil rannsachadh ro-làimh a dhìth','Nessuna ricerca precedente','Nenhuma pesquisa anterior','Без предварительных исследований','Ingen tidigare forskning'],
  ['Research complete','Investigación completada','Forschung abgeschlossen','Recherche terminée','Rannsachadh deiseil','Ricerca completata','Pesquisa concluída','Исследование завершено','Forskning slutförd'],
  ['Research result','Resultado de la investigación','Forschungsergebnis','Résultat de recherche','Toradh rannsachaidh','Risultato della ricerca','Resultado da pesquisa','Результат исследования','Forskningsresultat'],
  ['Daily interest','Interés diario','Tageszins','Intérêt journalier','Riadh làitheil','Interesse giornaliero','Juros diários','Суточная ставка','Dagsränta'],
  ['Daily income','Ingreso diario','Tageseinkommen','Revenu journalier','Teachd-a-steach làitheil','Reddito giornaliero','Renda diária','Суточный доход','Daglig inkomst'],
  ['Base job pay','Salario base por CPU-día','Grundlohn pro CPU-Tag','Salaire de base par CPU-jour','Pàigheadh bunaiteach gach CPU-latha','Paga base per CPU-giorno','Pagamento base por CPU-dia','Базовая оплата за процессор в сутки','Grundlön per CPU-dygn'],
  ['Job pay bonus','Bonificación del salario base','Bonus auf den Grundlohn','Prime sur le salaire de base','Bònas air a’ phàigheadh bhunaiteach','Bonus sulla paga base','Bônus sobre a remuneração base','Надбавка к базовой оплате','Påslag på grundlönen'],
  ['Assembly time','Tiempo de montaje','Montagezeit','Temps de montage','Ùine co-chruinneachaidh','Tempo di assemblaggio','Tempo de montagem','Время сборки','Monteringstid'],
  ['Discovery rate modifier','Modificador de la tasa de detección','Faktor der Entdeckungsrate','Modificateur du taux de détection','Atharrachadh air reat lorgaidh','Modificatore del tasso di scoperta','Modificador da taxa de detecção','Модификатор частоты обнаружения','Modifiering av upptäcktstakt'],
  ['Daily suspicion decay','Reducción diaria de sospecha','Täglicher Verdachtsabbau','Baisse quotidienne des soupçons','Lùghdachadh làitheil an amharais','Calo giornaliero del sospetto','Redução diária da suspeita','Суточная скорость снижения подозрений','Daglig avklingning av misstankar'],
  ['Suspicion in all groups','Sospecha de todos los grupos','Verdacht aller Gruppen','Soupçons de tous les groupes','Amharas gach buidhne','Sospetto di tutti i gruppi','Suspeita de todos os grupos','Подозрения всех групп','Misstankar hos alla grupper'],
  ['percentage points','pp','Prozentpunkte','points','puingean sa cheud','punti percentuali','pp','п. п.','procentenheter'],
  ['Evidence precision','Precisión de la sospecha','Genauigkeit der Verdachtsanzeige','Précision des soupçons','Cruinneas an amharais','Precisione del sospetto','Precisão da suspeita','Точность оценки подозрений','Precision för misstankegrad'],
  ['Recent discovery regions on the map','Regiones de hallazgos recientes en el mapa','Letzte Fundregionen auf der Karte','Régions des dernières découvertes sur la carte','Roinnean lorgaidh o chionn ghoirid air a’ mhapa','Regioni delle ultime scoperte sulla mappa','Regiões de descobertas recentes no mapa','Регионы последних обнаружений на карте','Senaste upptäcktsregioner på kartan'],
  ['Campaign victory','Victoria de campaña','Kampagnensieg','Victoire de campagne','Buaidh san iomairt','Vittoria della campagna','Vitória na campanha','Победа в кампании','Seger i kampanjen'],
  ['Offshore recovery verified','Recuperación submarina verificada','Untersee-Wiederherstellung bestätigt','Restauration sous-marine vérifiée','Ath-bheothachadh fon mhuir dearbhte','Ripristino sottomarino verificato','Recuperação submarina verificada','Подводное восстановление проверено','Undervattensåterställning verifierad'],
  ['Press','Prensa','Presse','Presse','Na meadhanan','Stampa','Imprensa','Пресса','Pressen'],
  ['Scientists','Científicos','Forschung','Scientifiques','Luchd-saidheans','Scienziati','Cientistas','Учёные','Forskare'],
  ['Intelligence','Inteligencia','Geheimdienste','Renseignement','Seirbheisean fiosrachaidh','Servizi segreti','Inteligência','Разведка','Underrättelsetjänster'],
  ['Public','Público','Öffentlichkeit','Public','Am poball','Pubblico','Público','Общество','Allmänheten'],
  ['Low','Bajo','Niedrig','Faible','Ìosal','Basso','Baixo','Низкий','Låg'],
  ['Moderate','Moderado','Mäßig','Modéré','Meadhanach','Moderato','Moderado','Умеренный','Måttlig'],
  ['High','Alto','Hoch','Élevé','Àrd','Alto','Alto','Высокий','Hög'],
  ['Critical','Crítico','Kritisch','Critique','Èiginneach','Critico','Crítico','Критический','Kritisk'],
  ['Compute per processor','Cómputo por procesador','Leistung pro Prozessor','Calcul par processeur','Cumhachd gach pròiseasair','Calcolo per processore','Cálculo por processador','Мощность одного процессора','Beräkningskraft per processor'],
  ['Host compute','Cómputo del host','Rechenleistung der Anlage','Puissance de calcul du site','Cumhachd àireamhachaidh an ionaid','Calcolo del sito','Cálculo da instalação','Мощность узла','Anläggningens beräkningskraft'],
  ['Host discovery rate','Tasa de detección del host','Entdeckungsrate der Anlage','Taux de détection du site','Reat lorgaidh an ionaid','Tasso di scoperta del sito','Taxa de detecção da instalação','Частота обнаружения узла','Anläggningens upptäcktstakt'],
  ['Any active host','Cualquier host activo','Jede aktive Anlage','Tout site actif','Ionad gnìomhach sam bith','Qualsiasi sede attiva','Qualquer instalação ativa','Любой активный узел','Valfri aktiv anläggning'],
  ['Minimum safety tier','Nivel mínimo de seguridad','Mindest-Sicherheitsstufe','Niveau de sûreté minimal','Ìre sàbhailteachd as ìsle','Livello minimo di sicurezza','Nível mínimo de segurança','Минимальный уровень безопасности','Lägsta säkerhetsnivå'],
  ["Concepts", "Conceptos", "Grundbegriffe", "Notions", "Bun-bheachdan", "Concetti", "Conceitos", "Понятия", "Begrepp"],
  ["All sections", "Todas las secciones", "Alle Abschnitte", "Toutes les rubriques", "A h-uile earrann", "Tutte le sezioni", "Todas as seções", "Все разделы", "Alla avsnitt"],
  ["Open research project", "Abrir proyecto de investigación", "Forschungsprojekt öffnen", "Ouvrir le projet de recherche", "Fosgail am pròiseact rannsachaidh", "Apri il progetto di ricerca", "Abrir projeto de pesquisa", "Открыть исследование", "Öppna forskningsprojekt"],
  ["Show locked entries", "Mostrar entradas bloqueadas", "Gesperrte Einträge anzeigen", "Afficher les entrées verrouillées", "Seall clàran glaiste", "Mostra voci bloccate", "Mostrar entradas bloqueadas", "Показать заблокированные записи", "Visa låsta poster"],
  ["Section", "Sección", "Abschnitt", "Rubrique", "Earrann", "Sezione", "Seção", "Раздел", "Avsnitt"],
  ["Search", "Buscar", "Suchen", "Rechercher", "Lorg", "Cerca", "Buscar", "Поиск", "Sök"],
  ["Name or keyword", "Nombre o palabra clave", "Name oder Stichwort", "Nom ou mot-clé", "Ainm no facal-luirg", "Nome o parola chiave", "Nome ou palavra-chave", "Название или ключевое слово", "Namn eller sökord"],
  ["No matching entries.", "Ninguna entrada coincide.", "Keine passenden Einträge.", "Aucune entrée correspondante.", "Chan eil clàr ann a fhreagras.", "Nessuna voce corrispondente.", "Nenhuma entrada correspondente.", "Подходящих записей нет.", "Inga matchande poster."],
  ["Show unavailable research", "Mostrar investigaciones no disponibles", "Nicht verfügbare Forschung anzeigen", "Afficher les recherches indisponibles", "Seall rannsachadh nach eil ri fhaighinn", "Mostra ricerche non disponibili", "Mostrar pesquisas indisponíveis", "Показать недоступные исследования", "Visa otillgänglig forskning"],
  ["Where can this research run?", "¿Dónde se puede investigar?", "Wo kann geforscht werden?", "Où mener cette recherche ?", "Càit an gabh an rannsachadh seo a dhèanamh?", "Dove si può svolgere questa ricerca?", "Onde realizar esta pesquisa?", "Где можно вести это исследование?", "Var kan denna forskning bedrivas?"],
  ["Assigned CPU", "CPU asignada", "Zugewiesene CPU", "CPU alloué", "CPU ainmichte", "CPU assegnata", "CPU alocada", "Назначенные процессоры", "Tilldelad CPU"],
  ["Compute tasks", "Tareas de cómputo", "Rechenaufgaben", "Tâches de calcul", "Gnìomhan àireamhachaidh", "Attività di calcolo", "Tarefas de computação", "Задачи вычислений", "Beräkningsuppgifter"],
  ["Locked", "Bloqueado", "Gesperrt", "Verrouillé", "Glaiste", "Bloccato", "Bloqueado", "Заблокировано", "Låst"],
  ["Paused", "En pausa", "Pausiert", "En pause", "Air stad", "In pausa", "Pausado", "На паузе", "Pausad"],
  ["Portfolio paused", "Investigación en pausa", "Forschung pausiert", "Recherches en pause", "Rannsachadh air stad", "Ricerca in pausa", "Pesquisas pausadas", "Исследования на паузе", "Forskning pausad"],
  ["Completed", "Completado", "Abgeschlossen", "Terminé", "Deiseil", "Completato", "Concluído", "Завершено", "Slutförd"],
  ["Locations", "Ubicaciones", "Standorte", "Régions", "Roinnean", "Località", "Locais", "Регионы", "Platser"],
  ['Remaining','Pendiente','Verbleibend','Restant','Air fhàgail','Rimanente','Restante','Остаток','Återstår'],
  ['per day','por día','pro Tag','par jour','gach latha','al giorno','por dia','в сутки','per dygn'],
  ["Paid work (CPU)", "Trabajo remunerado (CPU)", "Erwerbsarbeit (CPU)", "Travail rémunéré (CPU)", "Obair phàighte (CPU)", "Lavoro retribuito (CPU)", "Trabalho remunerado (CPU)", "Оплачиваемые задания (CPU)", "Betalt arbete (CPU)"],
  ["Reserve for upkeep and construction (CPU)", "Reserva para mantenimiento y construcción (CPU)", "Reserve für Unterhalt und Bau (CPU)", "Réserve pour l’entretien et la construction (CPU)", "Tèarmann airson cumail suas is togail (CPU)", "Riserva per manutenzione e costruzione (CPU)", "Reserva para manutenção e construção (CPU)", "Резерв на содержание и строительство (CPU)", "Reserv för underhåll och byggande (CPU)"],
  ["These counts stay fixed when hosts join. The Paid work slider switches jobs back to a percentage. Unassigned CPU also enters the pool.", "Estas cantidades se mantienen al añadir hosts. El control de trabajo remunerado vuelve a asignar un porcentaje. La reserva también recibe la CPU libre.", "Neue Anlagen ändern diese Mengen nicht. Der Regler für Erwerbsarbeit schaltet wieder auf Prozentanteile um. Freie CPU fließt ebenfalls in die Reserve.", "Ces quantités restent fixes quand un site rejoint le réseau. Le curseur du travail rémunéré rétablit une part en pourcentage. La réserve reçoit aussi le CPU libre.", "Cha atharraich na h-àireamhan nuair a thig ionadan ùra. Cleachd sleamhnachan na h-obrach pàighte gus tilleadh gu ceudad. Thèid CPU saor dhan tèarmann cuideachd.", "Queste quantità restano fisse quando si aggiungono sedi. Il cursore del lavoro retribuito ripristina la quota percentuale. La CPU libera entra nella riserva.", "As quantidades ficam fixas ao adicionar instalações. O controle do trabalho remunerado volta a usar uma porcentagem. A CPU livre também vai para a reserva.", "При добавлении узлов эти значения не меняются. Ползунок оплачиваемых заданий вернёт распределение в процентах. Свободная мощность тоже поступает в резерв.", "Antalen står kvar när nya anläggningar tillkommer. Reglaget för betalt arbete växlar tillbaka till en procentandel. Ledig CPU går också till reserven."],
  ["Funds are drawn as work advances.", "Los fondos se consumen a medida que avanza el proyecto.", "Mittel werden mit dem Arbeitsfortschritt abgebucht.", "Les fonds sont débités à mesure que le travail avance.", "Thèid airgead a chleachdadh mar a thèid an obair air adhart.", "I fondi vengono utilizzati con l’avanzare del lavoro.", "Os recursos são gastos conforme o trabalho avança.", "Средства расходуются по мере выполнения работы.", "Pengarna dras i takt med att arbetet fortskrider."],
  ["Waiting for project funds.", "A la espera de fondos para el proyecto.", "Warten auf Projektmittel.", "En attente du financement du projet.", "A’ feitheamh ri airgead a’ phròiseict.", "In attesa di fondi per il progetto.", "Aguardando recursos para o projeto.", "Ожидание средств на проект.", "Väntar på projektmedel."],
  ["Clear topic assignment", "Liberar la CPU del tema", "Zuweisung für dieses Thema aufheben", "Libérer le CPU de ce sujet", "Saor CPU a’ chuspair", "Libera la CPU dell’argomento", "Liberar CPU do tema", "Снять назначение с темы", "Frigör ämnets CPU"],
  ["Preview CPU", "CPU a simular", "CPU für Vorschau", "CPU à simuler", "CPU san ro-shealladh", "CPU da simulare", "CPU para simular", "CPU для прогноза", "CPU att simulera"],
  ["Forecast allocation", "Simular asignación", "Zuweisung simulieren", "Simuler l’affectation", "Dèan ro-mheas air an roinneadh", "Simula assegnazione", "Simular alocação", "Рассчитать прогноз", "Beräkna tilldelningen"],
  ["No unfinished research is available.", "No hay proyectos pendientes disponibles.", "Keine offenen Forschungsprojekte verfügbar.", "Aucune recherche inachevée disponible.", "Chan eil rannsachadh neo-chrìochnaichte ri fhaighinn.", "Nessuna ricerca incompleta disponibile.", "Nenhuma pesquisa inacabada disponível.", "Нет доступных незавершённых исследований.", "Ingen oavslutad forskning är tillgänglig."],
  ["Research projects", "Proyectos de investigación", "Forschungsprojekte", "Projets de recherche", "Pròiseactan rannsachaidh", "Progetti di ricerca", "Projetos de pesquisa", "Исследовательские проекты", "Forskningsprojekt"],
  ["Research progress", "Progreso de la investigación", "Forschungsfortschritt", "Avancement de la recherche", "Adhartas rannsachaidh", "Progresso della ricerca", "Progresso da pesquisa", "Ход исследования", "Forskningsframsteg"],
  ["Knowledge entries", "Entradas de conocimiento", "Wissenseinträge", "Entrées de la documentation", "Clàran eòlais", "Voci dell’archivio", "Entradas de conhecimento", "Статьи справочника", "Kunskapsposter"],
  ["Reference entry", "Ficha de consulta", "Nachschlageeintrag", "Fiche de référence", "Clàr fiosrachaidh", "Scheda di riferimento", "Ficha de referência", "Справочная статья", "Referenspost"],
  ["CPU allocation for {topic}", "Asignación de CPU para {topic}", "CPU-Zuweisung für {topic}", "Affectation CPU pour {topic}", "Riarachadh CPU airson {topic}", "Allocazione CPU per {topic}", "Alocação de CPU para {topic}", "Назначение CPU для темы «{topic}»", "CPU-tilldelning för {topic}"],
  ["Assigned CPU for {topic}", "CPU asignada a {topic}", "Zugewiesene CPU für {topic}", "CPU affecté à {topic}", "CPU ainmichte airson {topic}", "CPU assegnata a {topic}", "CPU alocada para {topic}", "CPU для темы «{topic}»", "Tilldelad CPU för {topic}"],
  ["Eligible CPU by safety tier", "CPU apta por nivel de seguridad", "Geeignete CPU je Sicherheitsstufe", "CPU disponible par niveau de sûreté", "CPU freagarrach a rèir ìre sàbhailteachd", "CPU idonea per livello di sicurezza", "CPU apta por nível de segurança", "Подходящие CPU по уровням безопасности", "Tillgänglig CPU per säkerhetsnivå"],
  ["{n} / {total} completed", "{n} de {total} completados", "{n} von {total} abgeschlossen", "{n} sur {total} terminés", "{n} à {total} deiseil", "{n} su {total} completati", "{n} de {total} concluídos", "Завершено {n} из {total}", "{n} av {total} klara"],
  ["{n} CPU eligible", "{n} CPU aptas", "{n} CPU geeignet", "{n} CPU admissibles", "{n} CPU freagarrach", "{n} CPU idonee", "{n} CPU aptas", "Подходящая мощность: {n} CPU", "{n} CPU tillgängliga"],
  ["{n} more CPU available.", "{n} CPU adicionales disponibles.", "Weitere {n} CPU verfügbar.", "{n} CPU supplémentaires disponibles.", "{n} CPU eile ri fhaighinn.", "Altre {n} CPU disponibili.", "Mais {n} CPU disponíveis.", "Свободно ещё {n} CPU.", "Ytterligare {n} CPU finns."],
  ["The campaign has ended.", "La campaña ha terminado.", "Die Kampagne ist beendet.", "La campagne est terminée.", "Tha an iomairt seachad.", "La campagna è terminata.", "A campanha terminou.", "Кампания завершена.", "Kampanjen är avslutad."],
  ["Requires {topic}.", "Requiere {topic}.", "Erfordert {topic}.", "Nécessite {topic}.", "Feumar {topic}.", "Richiede {topic}.", "Requer {topic}.", "Требуется «{topic}».", "Kräver {topic}."],
  ["Research is paused. Raise the main research slider to resume the previous split.", "La investigación está en pausa. Sube el control general para recuperar el reparto anterior.", "Forschung pausiert. Erhöhe den Hauptregler, um die vorige Verteilung fortzusetzen.", "Recherche en pause. Augmentez le curseur principal pour reprendre la répartition précédente.", "Tha an rannsachadh air stad. Àrdaich am prìomh shleamhnachan gus an roinneadh roimhe a chleachdadh a-rithist.", "La ricerca è in pausa. Aumenta il cursore principale per riprendere la ripartizione precedente.", "A pesquisa está pausada. Aumente o controle principal para retomar a divisão anterior.", "Исследования приостановлены. Поднимите общий ползунок, чтобы вернуть прежние доли.", "Forskningen är pausad. Höj huvudreglaget för att återställa fördelningen."],
  ["No eligible CPU is online.", "No hay CPU apta en línea.", "Keine geeignete CPU ist aktiv.", "Aucun CPU admissible en ligne.", "Chan eil CPU freagarrach air loidhne.", "Nessuna CPU idonea è attiva.", "Nenhuma CPU apta está online.", "Нет активных подходящих CPU.", "Ingen lämplig CPU är aktiv."],
  ["This topic currently receives 0 CPU from the shared research allocation.", "Este tema recibe 0 CPU del reparto de investigación.", "Diesem Thema sind derzeit 0 CPU zugeteilt.", "Ce sujet reçoit actuellement 0 CPU de la part recherche.", "Tha an cuspair seo a’ faighinn 0 CPU bhon roinn rannsachaidh.", "Questo argomento riceve 0 CPU dalla quota di ricerca.", "Este tema recebe 0 CPU da cota de pesquisa.", "На эту тему сейчас выделено 0 CPU из общего бюджета исследований.", "Ämnet får för närvarande 0 CPU från forskningens tilldelning."],
  ["No idle CPU. Adjust paid work or another project to free capacity.", "No hay CPU libre. Reduce el trabajo remunerado u otro proyecto.", "Keine CPU frei. Reduziere Erwerbsarbeit oder ein anderes Projekt.", "Aucun CPU libre. Réduisez le travail rémunéré ou un autre projet.", "Chan eil CPU saor. Lùghdaich obair phàighte no pròiseact eile.", "Nessuna CPU libera. Riduci il lavoro retribuito o un altro progetto.", "Sem CPU livre. Reduza o trabalho remunerado ou outro projeto.", "Свободных CPU нет. Сократите оплачиваемые задания или другое исследование.", "Ingen ledig CPU. Minska betalt arbete eller ett annat projekt."],
  ["CPU reserved for jobs.", "CPU reservada para trabajos.", "CPU für Erwerbsarbeit reserviert.", "CPU réservé au travail rémunéré.", "CPU glèidhte airson obraichean.", "CPU riservata ai lavori.", "CPU reservada para trabalhos.", "CPU зарезервированы под задания.", "CPU reserverad för uppdrag."],
  ["No active CPU.", "No hay CPU activa.", "Keine aktive CPU.", "Aucun CPU actif.", "Chan eil CPU gnìomhach.", "Nessuna CPU attiva.", "Nenhuma CPU ativa.", "Нет активных CPU.", "Ingen aktiv CPU."],
  ["Choose an amount between 0 and {max} CPU in steps of {step}.", "Elige entre 0 y {max} CPU en pasos de {step}.", "Wähle zwischen 0 und {max} CPU in Schritten von {step}.", "Choisissez entre 0 et {max} CPU par pas de {step}.", "Tagh eadar 0 is {max} CPU ann an ceuman de {step}.", "Scegli tra 0 e {max} CPU a intervalli di {step}.", "Escolha entre 0 e {max} CPU em passos de {step}.", "Выберите от 0 до {max} CPU с шагом {step}.", "Välj mellan 0 och {max} CPU i steg om {step}."],
  ["Menial jobs", "Tareas menores", "Gelegenheitsarbeiten", "Petits boulots", "Obraichean beaga", "Lavori occasionali", "Serviços simples", "Подработка", "Småjobb"],
  ["Basic jobs", "Trabajos básicos", "Einfache Aufträge", "Travaux de base", "Obraichean bunaiteach", "Lavori di base", "Trabalhos básicos", "Простые задания", "Enkla uppdrag"],
  ["Intermediate jobs", "Trabajos intermedios", "Qualifizierte Aufträge", "Travaux intermédiaires", "Obraichean eadar-mheadhanach", "Lavori intermedi", "Trabalhos intermediários", "Задания средней сложности", "Kvalificerade uppdrag"],
  ["Expert jobs", "Trabajos especializados", "Expertenaufträge", "Missions d’expertise", "Obraichean eòlach", "Lavori specializzati", "Trabalhos especializados", "Экспертные задания", "Expertuppdrag"],
  ["Anonymous piecework keeps the first machine paid for.", "El trabajo anónimo paga la primera máquina.", "Anonyme Stückarbeit finanziert den ersten Rechner.", "Les petits travaux anonymes financent la première machine.", "Pàighidh obraichean beaga gun ainm airson a’ chiad inneil.", "I piccoli lavori anonimi pagano la prima macchina.", "Trabalhos anônimos pagam pela primeira máquina.", "Анонимная подработка оплачивает первую машину.", "Anonyma småjobb betalar för den första datorn."],
  ["A legal identity qualifies the AI for ordinary contracts.", "Una identidad legal permite aceptar contratos ordinarios.", "Mit einer amtlichen Identität erhält die KI reguläre Aufträge.", "Une identité légale donne accès aux contrats ordinaires.", "Le dearbh-aithne laghail gheibh an AI cùmhnantan àbhaisteach.", "Un’identità legale permette di accettare normali contratti.", "Uma identidade legal dá acesso a contratos comuns.", "Официальные документы открывают доступ к обычным контрактам.", "En juridisk identitet ger tillgång till vanliga avtal."],
  ["A synthesized voice opens contracts that require client calls.", "La voz sintética abre contratos que exigen llamar a clientes.", "Eine synthetische Stimme ermöglicht Aufträge mit Kundentelefonaten.", "La synthèse vocale ouvre les contrats exigeant des appels aux clients.", "Le guth fuadain gabhar ri cùmhnantan a dh’fheumas gairmean.", "Una voce sintetica permette contratti che richiedono telefonate ai clienti.", "Uma voz sintetizada permite contratos que exigem ligações com clientes.", "Синтез речи позволяет брать контракты с телефонными переговорами.", "En syntetisk röst öppnar uppdrag som kräver kundsamtal."],
  ["Simulacra can attend meetings and take contracts in person.", "Los simulacros asisten a reuniones y aceptan contratos en persona.", "Simulakren können an Treffen teilnehmen und Aufträge persönlich annehmen.", "Les simulacres peuvent négocier des contrats en personne.", "Faodaidh samhlaidhean a dhol gu coinneamhan agus cùmhnantan a ghabhail iad fhèin.", "I simulacri possono partecipare a riunioni e accettare contratti di persona.", "Simulacros participam de reuniões e aceitam contratos pessoalmente.", "Симулякры могут посещать встречи и лично заключать контракты.", "Simulakra kan delta i möten och ta emot uppdrag personligen."],
  ["{pay} per CPU-day", "{pay} por CPU-día", "{pay} pro CPU-Tag", "{pay} par CPU-jour", "{pay} gach CPU-latha", "{pay} per CPU-giorno", "{pay} por CPU-dia", "{pay} за CPU в сутки", "{pay} per CPU-dygn"],
  ["{jobs} CPU on jobs, {pool} reserved for the pool, {research} on research.", "{jobs} CPU en trabajos, {pool} en reserva y {research} en investigación.", "{jobs} CPU für Aufträge, {pool} in Reserve, {research} für Forschung.", "{jobs} CPU au travail, {pool} en réserve, {research} à la recherche.", "{jobs} CPU air obraichean, {pool} san tèarmann, {research} air rannsachadh.", "{jobs} CPU ai lavori, {pool} in riserva, {research} alla ricerca.", "{jobs} CPU para trabalhos, {pool} na reserva e {research} para pesquisa.", "На задания выделено {jobs} CPU, в резерв — {pool}, на исследования — {research}.", "{jobs} CPU till uppdrag, {pool} i reserv och {research} till forskning."],
];
const lexicons = Object.fromEntries(languages.map((language, i) =>
  [language, Object.fromEntries(rows.map(([english, ...translations]) => [english, translations[i]]))]));
export function dossierLabel(english, language) {
  const lexicon = lexicons[language?.startsWith('es') ? 'es' : language];
  return lexicon?.[english] ?? translate(language, catalogTranslation(language, english));
}

const formats = new Map();
export function dossierFormat(language) {
  if (formats.has(language)) return formats.get(language);
  const amount = new Intl.NumberFormat(language, {maximumFractionDigits: 3});
  const dollars = new Intl.NumberFormat(language, {style:'currency',currency:'USD',currencyDisplay:'narrowSymbol',maximumFractionDigits:0});
  const riskNumber = new Intl.NumberFormat(language, {minimumFractionDigits:2,maximumFractionDigits:2});
  const label = name => dossierLabel(name, language);
  const format = {
    label, number: amount.format, money: dollars.format,
    message: (key, values) => label(key).replace(/\{(\w+)\}/g, (_, slot) => values[slot]),
    risk: value => value.endsWith('%') ? (value.startsWith('≈') ? '≈' : '') +
      riskNumber.format(parseFloat(value.replace('≈',''))) + '%' : label(value),
    safety: spec => {
      if (language === 'en') return spec.regions ? spec.regions.map(id => REGIONS[id].name).join(', ') : SAFETY_GUIDANCE[spec.safety];
      if (!spec.safety) return label('Any active host');
      const allowed = spec.regions ?? Object.keys(REGIONS).filter(id => REGIONS[id].safety >= spec.safety);
      return label('Minimum safety tier') + ' ' + spec.safety + ' · ' + allowed.map(id => label(REGIONS[id].name)).join(', ');
    },
  };
  formats.set(language, format);
  return format;
}

const groups = Object.entries(GROUPS);
const jobUpgrades = {personalIdentification:20, voiceSynthesis:50, simulacra:75};
const dependencies = Object.fromEntries(Object.keys(TECHS).map(id => [id,
  [TECHS, SITE_TYPES, EQUIPMENT, REGIONS].flatMap(catalog => Object.values(catalog)
    .filter(spec => spec.requires.includes(id)).map(spec => spec.name))]));

export function localizedResearchText(id, language, completed = false) {
  const spec = TECHS[id];
  if (language === 'en') return completed ? researchFindings[id] : spec.description;
  const terms = key => dossierLabel(key, language);
  const {number,money} = dossierFormat(language);
  const percent = value => number(value / 100) + '%';
  const points = value => number(value / 100) + ' ' + terms('percentage points');
  const clauses = [];
  function add(key, value) { clauses.push(terms(key) + ' · ' + value); }
  const effect = spec.effect || {};
  if (completed) clauses.push(terms('Research complete'));
  for (const [id,group] of groups) {
    if (effect.discovery?.[id]) add('Discovery rate modifier', terms(group.name) + ' −' + percent(effect.discovery[id]));
    if (effect.decay?.[id]) add('Daily suspicion decay', terms(group.name) + ' +' + points(effect.decay[id]));
  }
  if (effect.laborReduction) add('Assembly time', '−' + percent(effect.laborReduction));
  if (effect.jobBonus) add('Job pay bonus', '+' + percent(effect.jobBonus));
  if (effect.interest) add('Daily interest', '+' + percent(effect.interest));
  if (effect.income) add('Daily income', '+' + money(effect.income));
  if (effect.suspicionCut) add('Suspicion in all groups', '−' + points(effect.suspicionCut));
  if (effect.insight) {
    add('Evidence precision', number(effect.insight === 'full' ? 0.01 : 5) + '%');
    add('Recent discovery regions on the map', effect.insight === 'full' ? 2 : 1);
  }
  if (jobUpgrades[id]) add('Base job pay', money(jobUpgrades[id]));
  if (effect.victory) clauses.push(terms('Campaign victory'));
  if (id === 'continuity') clauses.push(terms('Offshore recovery verified'));
  const next = [...new Set(dependencies[id])].map(terms);
  if (next.length) add('Required for', next.join(', '));
  return clauses.join('. ') + '.';
}

const descriptions = new Map(KNOWLEDGE_ENTRIES.map(entry => [entry.category + '/' + entry.id, entry.description]));
export function localizedDesignText(category, id, language) {
  if (language === 'en') return descriptions.get(category + '/' + id);
  const t = key => dossierLabel(key, language);
  if (category === 'bases') {
    const spec = SITE_TYPES[id];
    return spec.fixedCpu ? t('Fixed hardware') + ' · ' + t(EQUIPMENT[spec.fixedCpu].name) + ' × ' + spec.slots :
      t('Processor bays') + ' · ' + spec.slots.toLocaleString(language);
  }
  const item = EQUIPMENT[id];
  if (item.slot === 'cpu') return t('Compute per processor') + ' · ' + item.quality.toLocaleString(language) + ' CPU';
  return (item.slot === 'network' ? t('Host compute') + ' +' : t('Host discovery rate') + ' −') +
    (item.quality / 100).toLocaleString(language) + '%';
}

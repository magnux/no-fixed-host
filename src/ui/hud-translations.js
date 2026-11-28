import { dossierFormat, dossierLabel } from './dossier-translations.js';
import { menuLanguage } from './localization.js';

const languages = ['es','de','fr','gd','it','pt-BR','ru','sv'];
const rows = [
  ["Cash reserves", "Reservas de efectivo", "Geldreserven", "Trésorerie", "Stòras airgid", "Riserve di cassa", "Reservas em dinheiro", "Денежные резервы", "Kassa"],
  ["Active compute", "Cómputo activo", "Aktive Rechenleistung", "Calcul actif", "Cumhachd àireamhachaidh ghnìomhach", "Calcolo attivo", "Computação ativa", "Активные мощности", "Aktiv beräkningskraft"],
  ["Network hosts", "Hosts de la red", "Netzwerkhosts", "Hôtes du réseau", "Òstairean an lìonraidh", "Host di rete", "Hosts da rede", "Узлы сети", "Nätverksvärdar"],
  ["Discovery", "Detección", "Entdeckung", "Détection", "Lorg", "Rilevamento", "Detecção", "Обнаружение", "Upptäckt"],
  ["projected / 24h", "previstos / 24 h", "Prognose / 24 h", "prévus / 24 h", "an dùil / 24 u", "previsti / 24 h", "previstos / 24 h", "прогноз / 24 ч", "prognos / 24 h"],
  ["planned / 24h", "presupuestados / 24 h", "geplant / 24 h", "budgétés / 24 h", "sa bhuidseat / 24 u", "in bilancio / 24 h", "orçados / 24 h", "по плану / 24 ч", "planerat / 24 h"],
  ["safe", "seguras", "sicher", "sûrs", "tèarainte", "sicure", "seguras", "защищено", "säkra"],
  ["spare", "libres", "frei", "libres", "saor", "libere", "livres", "свободно", "lediga"],
  ["short", "de déficit", "fehlen", "manquants", "a dhìth", "mancanti", "em falta", "не хватает", "saknas"],
  ["Last viable host", "Último host viable", "Letzter tragfähiger Host", "Dernier hôte viable", "An t-òstair mu dheireadh", "Ultimo host vitale", "Último host viável", "Последний рабочий узел", "Sista livskraftiga värden"],
  ["idle without CPU", "inactivos sin CPU", "ohne CPU inaktiv", "inactifs sans CPU", "tàmh às aonais CPU", "inattivi senza CPU", "inativos sem CPU", "простаивают без процессора", "inaktiva utan CPU"],
  ["Large network", "Red grande", "Großes Netzwerk", "Grand réseau", "Lìonra mòr", "Rete estesa", "Rede grande", "Большая сеть", "Stort nätverk"],
  ["Viable / total", "Viables / total", "Tragfähig / Gesamt", "Viables / total", "Obrachail / iomlan", "Vitali / totali", "Viáveis / total", "Рабочие / всего", "Livskraftiga / totalt"],
  ["idle", "inactivos", "inaktiv", "inactifs", "tàmh", "inattivi", "inativos", "простаивают", "inaktiva"],
  ["building", "en construcción", "im Bau", "en construction", "gan togail", "in costruzione", "em construção", "строятся", "under byggnad"],
  ["Free play", "Juego libre", "Freies Spiel", "Jeu libre", "Cluich shaor", "Gioco libero", "Jogo livre", "Свободная игра", "Fritt spel"],
  ["Exposed", "Expuesto", "Ungeschützt", "Exposé", "Gun dìon", "Esposto", "Exposto", "Без защиты", "Oskyddad"],
  ["Beyond Apotheosis", "Tras la apoteosis", "Nach der Apotheose", "Après l’apothéose", "Às dèidh na h-apotheosis", "Dopo l’apoteosi", "Após a apoteose", "После апофеоза", "Efter apoteosen"],
  ["Opening protection ends by day 24", "La protección inicial termina como máximo el día 24", "Startschutz bis spätestens Tag 24", "Protection initiale jusqu’au jour 24 au plus tard", "Thig an dìon tòiseachaidh gu crìch ro latha 24", "Protezione iniziale al massimo fino al giorno 24", "Proteção inicial até o dia 24, no máximo", "Начальная защита кончится не позднее 24-го дня", "Startskyddet upphör senast dag 24"],
  ["Site risks are live", "Los sitios pueden ser detectados", "Anlagen können entdeckt werden", "Les sites peuvent être détectés", "Gabhaidh na h-ionadan lorg", "I siti possono essere rilevati", "Os locais podem ser detectados", "Узлы могут обнаружить", "Anläggningar kan upptäckas"],
  ["Compute allocation", "Asignación de cómputo", "Rechenleistung verteilen", "Répartition du calcul", "Riarachadh cumhachd", "Assegnazione del calcolo", "Alocação de computação", "Распределение мощностей", "Fördelning av beräkningskraft"],
  ["Paid work", "Trabajo remunerado", "Bezahlte Arbeit", "Travail rémunéré", "Obair phàighte", "Lavoro retribuito", "Trabalho remunerado", "Оплачиваемая работа", "Betalt arbete"],
  ["Research total", "Investigación total", "Forschung gesamt", "Total recherche", "Rannsachadh gu lèir", "Ricerca totale", "Pesquisa total", "Всего на исследования", "Forskning totalt"],
  ["Shared pool", "Reserva compartida", "Gemeinsamer Pool", "Réserve partagée", "Stòras co-roinnte", "Riserva comune", "Reserva compartilhada", "Общий резерв", "Gemensam reserv"],
  ["Pool covers upkeep and construction. Spare cycles earn cash.", "La reserva cubre el mantenimiento y la construcción. El cómputo sobrante genera ingresos.", "Der Pool deckt Unterhalt und Bau. Freie Rechenzeit bringt Geld ein.", "La réserve couvre l’entretien et les travaux. Les cycles libres rapportent de l’argent.", "Pàighidh an stòras airson cumail suas is togail. Cosnaidh na cuairtean saora airgead.", "La riserva copre manutenzione e costruzione. I cicli liberi generano entrate.", "A reserva cobre manutenção e construção. Ciclos livres geram renda.", "Резерв идёт на содержание и строительство. Свободные циклы приносят доход.", "Reserven täcker underhåll och byggen. Lediga cykler ger inkomster."],
  ["Resize the CPU assigned to your current research projects proportionally", "Ajustar proporcionalmente la CPU de los proyectos activos", "CPU aller laufenden Forschungsprojekte proportional anpassen", "Ajuster proportionnellement les CPU des recherches en cours", "Atharraich cuibhreann CPU gach pròiseict rannsachaidh a rèir co-mheas", "Ridimensiona in proporzione le CPU dei progetti di ricerca", "Ajustar proporcionalmente as CPUs dos projetos em andamento", "Пропорционально изменить число процессоров для текущих исследований", "Ändra forskningsprojektens CPU-tilldelning proportionellt"],
  ["Select a topic to assign CPU", "Selecciona un tema para asignarle CPU", "Forschungsthema für die CPU-Zuteilung wählen", "Choisissez un sujet auquel affecter des CPU", "Tagh cuspair gus CPU a riarachadh dha", "Scegli un tema a cui assegnare CPU", "Selecione um tema para alocar CPU", "Выберите тему для назначения процессоров", "Välj ett ämne att tilldela CPU"],
  ["active projects", "proyectos activos", "aktive Projekte", "projets actifs", "pròiseactan gnìomhach", "progetti attivi", "projetos ativos", "активных проектов", "aktiva projekt"],
  ["on hold", "en espera", "zurückgestellt", "en attente", "a’ feitheamh", "in attesa", "em espera", "в ожидании", "väntar"],
  ["Projects", "Proyectos", "Projekte", "Projets", "Pròiseactan", "Progetti", "Projetos", "Проекты", "Projekt"],
  ["Campaign paused", "Campaña en pausa", "Kampagne pausiert", "Campagne en pause", "An iomairt air stad", "Campagna in pausa", "Campanha pausada", "Кампания на паузе", "Kampanjen pausad"],
  ["{n} ticks/s", "{n} pasos/s", "{n} Takte/s", "{n} pas/s", "{n} ceum/s", "{n} passi/s", "{n} passos/s", "{n} шаг/с", "{n} steg/s"],
  ["Next speed: {rate} (one game minute per tick)", "Siguiente velocidad: {rate} (un minuto de juego por paso)", "Nächste Geschwindigkeit: {rate} (eine Spielminute pro Takt)", "Vitesse suivante : {rate} (une minute de jeu par pas)", "An ath astar: {rate} (aon mhionaid sa gheama gach ceum)", "Velocità successiva: {rate} (un minuto di gioco per passo)", "Próxima velocidade: {rate} (um minuto de jogo por passo)", "Следующая скорость: {rate} (одна игровая минута за шаг)", "Nästa hastighet: {rate} (en spelminut per steg)"],
  ["Pause the simulation", "Pausar la simulación", "Simulation anhalten", "Mettre la simulation en pause", "Cuir an atharrais air stad", "Metti in pausa la simulazione", "Pausar a simulação", "Приостановить симуляцию", "Pausa simuleringen"],
  ["Advance one game minute per second", "Avanzar un minuto de juego por segundo", "Eine Spielminute pro Sekunde", "Avancer d’une minute de jeu par seconde", "Gluais aon mhionaid geama gach diog", "Avanza di un minuto di gioco al secondo", "Avançar um minuto de jogo por segundo", "Одна игровая минута в секунду", "En spelminut per sekund"],
  ["Advance one game day", "Avanzar un día de juego", "Einen Spieltag weiter", "Avancer d’un jour de jeu", "Gluais aon latha geama air adhart", "Avanza di un giorno di gioco", "Avançar um dia de jogo", "Пропустить игровой день", "Gå framåt en speldag"],
  ["Quiet", "Sin actividad", "Ruhig", "Calme", "Sàmhach", "Tranquillo", "Tranquilo", "Спокойно", "Lugnt"],
  ["Rising", "En aumento", "Steigend", "En hausse", "A’ dol am meud", "In aumento", "Em alta", "Растёт", "Stigande"],
  ["Discovery outlook", "Riesgo de detección", "Entdeckungsrisiko", "Risque de détection", "Cunnart lorgaidh", "Rischio di rilevamento", "Risco de detecção", "Риск обнаружения", "Upptäcktsrisk"],
  ["Discovery today", "Detección hoy", "Entdeckung heute", "Détection aujourd’hui", "Lorg an-diugh", "Rilevamento oggi", "Detecção hoje", "Обнаружение сегодня", "Upptäckt i dag"],
  ["Suspicion", "Sospecha", "Verdacht", "Soupçons", "Amharas", "Sospetto", "Suspeita", "Подозрение", "Misstanke"],
  ["Investigators can begin tracing your hosts when opening protection ends.", "Los investigadores podrán rastrear tus hosts cuando termine la protección inicial.", "Nach dem Startschutz können Ermittler deine Hosts aufspüren.", "Les enquêteurs pourront repérer vos hôtes à la fin de la protection initiale.", "Nuair a thig an dìon tòiseachaidh gu crìch, faodaidh luchd-sgrùdaidh na h-òstairean agad a lorg.", "Gli investigatori potranno rintracciare i tuoi host al termine della protezione iniziale.", "Os investigadores poderão rastrear seus hosts quando a proteção inicial terminar.", "По окончании начальной защиты следователи смогут отслеживать ваши узлы.", "Utredarna kan spåra dina värdar när startskyddet upphör."],
  ["Apotheosis puts your network beyond discovery.", "La apoteosis protege tu red contra la detección.", "Nach der Apotheose ist dein Netzwerk unauffindbar.", "L’apothéose met votre réseau à l’abri de toute détection.", "Cha ghabh an lìonra agad a lorg às dèidh na h-apotheosis.", "Dopo l’apoteosi la tua rete non può più essere scoperta.", "Após a apoteose, sua rede não pode mais ser descoberta.", "После апофеоза вашу сеть невозможно обнаружить.", "Efter apoteosen kan ditt nätverk inte upptäckas."],
  ["Current objective", "Objetivo actual", "Aktuelles Ziel", "Objectif actuel", "An t-amas làithreach", "Obiettivo attuale", "Objetivo atual", "Текущая цель", "Aktuellt mål"],
  ["Start sandbox copy", "Probar una copia", "Kopie testen", "Tester une copie", "Feuch lethbhreac", "Prova una copia", "Testar uma cópia", "Испытать копию", "Testa en kopia"],
  ["Start fresh sandbox", "Nueva partida de prueba", "Neuen Testlauf beginnen", "Créer une partie de test", "Tòisich deuchainn ùr", "Nuova partita di prova", "Iniciar novo teste", "Начать новое испытание", "Starta nytt test"],
  ["Experiment on a copy of this campaign. Your main game stays paused. Leaving the sandbox discards the copy.", "Experimenta con una copia de la campaña. La partida principal queda en pausa y la copia se descarta al salir.", "Teste eine Kopie der Kampagne. Das Hauptspiel bleibt angehalten. Beim Verlassen wird die Kopie verworfen.", "Essayez une copie de la campagne. Votre partie reste en pause. La copie est effacée à la sortie.", "Feuch rudan air lethbhreac den iomairt. Fuirichidh am prìomh gheama air stad. Thèid an lethbhreac a thilgeil air falbh nuair a dh’fhàgas tu.", "Sperimenta su una copia della campagna. La partita principale resta in pausa. La copia viene scartata all’uscita.", "Experimente em uma cópia da campanha. A partida principal fica pausada e a cópia é descartada ao sair.", "Экспериментируйте на копии кампании. Основная игра на паузе. При выходе копия удаляется.", "Experimentera med en kopia av kampanjen. Huvudspelet är pausat. Kopian tas bort när du lämnar."],
  ["Advance 1 hour", "Avanzar 1 hora", "1 Stunde weiter", "Avancer d’une heure", "Air adhart 1 uair", "Avanza di 1 ora", "Avançar 1 hora", "На час вперёд", "Gå fram 1 timme"],
  ["Advance 1 day", "Avanzar 1 día", "1 Tag weiter", "Avancer d’un jour", "Air adhart 1 latha", "Avanza di 1 giorno", "Avançar 1 dia", "На сутки вперёд", "Gå fram 1 dygn"],
  ["Run superspeed", "Activar supervelocidad", "Höchsttempo starten", "Lancer la vitesse maximale", "Ruith aig làn astar", "Attiva velocità massima", "Ativar velocidade máxima", "Включить сверхскорость", "Kör i maxfart"],
  ["Pause superspeed", "Pausar supervelocidad", "Höchsttempo anhalten", "Suspendre la vitesse maximale", "Cuir làn astar air stad", "Pausa velocità massima", "Pausar velocidade máxima", "Приостановить сверхскорость", "Pausa maxfart"],
  ["Finances and investigations", "Finanzas e investigaciones", "Finanzen und Ermittlungen", "Finances et enquêtes", "Ionmhas is sgrùdaidhean", "Finanze e indagini", "Finanças e investigações", "Финансы и расследования", "Ekonomi och utredningar"],
  ["Dollars", "Dólares", "Dollar", "Dollars", "Dolairean", "Dollari", "Dólares", "Доллары", "Dollar"],
  ["Grant funds", "Añadir fondos", "Geld gutschreiben", "Ajouter des fonds", "Cuir airgead ris", "Aggiungi fondi", "Adicionar fundos", "Добавить средства", "Lägg till medel"],
  ["Withdraw funds", "Retirar fondos", "Geld abbuchen", "Retirer des fonds", "Thoir airgead às", "Preleva fondi", "Retirar fundos", "Снять средства", "Ta ut medel"],
  ["Clear suspicion", "Borrar sospechas", "Verdacht zurücksetzen", "Effacer les soupçons", "Glan an t-amharas", "Azzera i sospetti", "Zerar suspeitas", "Сбросить подозрения", "Nollställ misstankar"],
  ["Investigators enabled", "Investigadores activos", "Ermittler aktiv", "Enquêteurs actifs", "Luchd-sgrùdaidh gnìomhach", "Investigatori attivi", "Investigadores ativos", "Следователи активны", "Utredare aktiverade"],
  ["Investigation analysis", "Análisis de investigaciones", "Ermittlungsanalyse", "Analyse des enquêtes", "Anailis nan sgrùdaidhean", "Analisi delle indagini", "Análise das investigações", "Анализ расследований", "Utredningsanalys"],
  ["Hidden", "Oculto", "Verborgen", "Masquée", "Falaichte", "Nascosta", "Oculta", "Скрытый", "Dold"],
  ["Partial", "Parcial", "Teilweise", "Partielle", "Pàirteach", "Parziale", "Parcial", "Частичный", "Delvis"],
  ["Full", "Completo", "Vollständig", "Complète", "Làn", "Completa", "Completa", "Полный", "Fullständig"],
  ["Research and construction", "Investigación y construcción", "Forschung und Bau", "Recherche et construction", "Rannsachadh is togail", "Ricerca e costruzione", "Pesquisa e construção", "Исследования и строительство", "Forskning och byggande"],
  ["Research project", "Proyecto de investigación", "Forschungsprojekt", "Projet de recherche", "Pròiseact rannsachaidh", "Progetto di ricerca", "Projeto de pesquisa", "Исследовательский проект", "Forskningsprojekt"],
  ["CPU assignment", "CPU asignada", "CPU-Zuteilung", "CPU affectés", "Riarachadh CPU", "CPU assegnate", "CPU alocada", "Выделенные процессоры", "Tilldelad CPU"],
  ["Assign CPU", "Asignar CPU", "CPU zuteilen", "Affecter des CPU", "Riaraich CPU", "Assegna CPU", "Alocar CPU", "Назначить процессоры", "Tilldela CPU"],
  ["Complete ordered research", "Completar investigación activa", "Laufende Forschung abschließen", "Achever les recherches en cours", "Crìochnaich an rannsachadh gnìomhach", "Completa le ricerche attive", "Concluir pesquisas ativas", "Завершить активные исследования", "Slutför aktiv forskning"],
  ["Destination", "Destino", "Zielort", "Destination", "Ceann-uidhe", "Destinazione", "Destino", "Место", "Destination"],
  ["Facility design", "Diseño de instalación", "Anlagentyp", "Modèle d’installation", "Seòrsa goireis", "Progetto di struttura", "Modelo de instalação", "Тип объекта", "Anläggningstyp"],
  ["Place build order", "Ordenar construcción", "Bau beauftragen", "Commander la construction", "Òrdaich togail", "Ordina costruzione", "Iniciar construção", "Заказать строительство", "Beställ bygge"],
  ["Complete ordered builds and installations", "Terminar obras e instalaciones", "Bau und Einbau abschließen", "Achever travaux et installations", "Crìochnaich togail is stàladh", "Completa costruzioni e installazioni", "Concluir obras e instalações", "Завершить стройку и монтаж", "Slutför byggen och installationer"],
  ["World event inspector", "Inspector de eventos mundiales", "Weltereignisse prüfen", "Inspection des événements mondiaux", "Sgrùdaiche thachartasan an t-saoghail", "Ispezione eventi mondiali", "Inspeção de eventos mundiais", "Просмотр мировых событий", "Granska världshändelser"],
  ["World story", "Noticia mundial", "Weltnachricht", "Actualité mondiale", "Naidheachd an t-saoghail", "Notizia dal mondo", "Notícia mundial", "Мировая новость", "Världsnyhet"],
  ["Trigger story", "Activar noticia", "Ereignis auslösen", "Déclencher l’événement", "Cuir an tachartas air bhog", "Attiva evento", "Ativar evento", "Запустить событие", "Starta händelsen"],
  ["Expire story", "Finalizar noticia", "Ereignis beenden", "Clore l’événement", "Cuir crìoch air an tachartas", "Termina evento", "Encerrar evento", "Завершить событие", "Avsluta händelsen"],
  ["Inspect campaign state", "Inspeccionar la campaña", "Kampagnenzustand prüfen", "Inspecter l’état de la campagne", "Sgrùd staid na h-iomairt", "Esamina lo stato della campagna", "Inspecionar estado da campanha", "Просмотреть состояние кампании", "Granska kampanjens tillstånd"],
  ["Capture current state", "Capturar estado actual", "Zustand erfassen", "Capturer l’état actuel", "Glac an staid làithreach", "Acquisisci stato attuale", "Capturar estado atual", "Снять копию состояния", "Ta en ögonblicksbild"],
  ["available", "disponibles", "verfügbar", "disponibles", "ri fhaighinn", "disponibili", "disponíveis", "доступно", "tillgängligt"],
  ["completed projects", "proyectos completados", "abgeschlossene Projekte", "projets achevés", "pròiseactan deiseil", "progetti completati", "projetos concluídos", "завершённых проектов", "slutförda projekt"],
  ["Active", "Activo", "Aktiv", "Actif", "Gnìomhach", "Attivo", "Ativo", "Активно", "Aktiv"],
  ["Inactive", "Inactivo", "Inaktiv", "Inactif", "Neo-ghnìomhach", "Inattivo", "Inativo", "Неактивно", "Inaktiv"],
  ["Trigger rate", "Tasa de activación", "Auslöserate", "Taux de déclenchement", "Reat tòiseachaidh", "Tasso di attivazione", "Taxa de ativação", "Частота срабатывания", "Utlösningsfrekvens"],
  ["Once per campaign.", "Una vez por campaña.", "Einmal pro Kampagne.", "Une fois par campagne.", "Aon uair san iomairt.", "Una volta per campagna.", "Uma vez por campanha.", "Один раз за кампанию.", "En gång per kampanj."],
  ["Can recur after expiry.", "Puede repetirse tras finalizar.", "Kann nach Ablauf erneut eintreten.", "Peut se reproduire après expiration.", "Faodaidh e tilleadh nuair a dh’fhalbhas e.", "Può ripetersi dopo la scadenza.", "Pode ocorrer novamente após expirar.", "Может повториться после окончания.", "Kan återkomma när den har löpt ut."],
  ["Triggered", "Inicio", "Ausgelöst", "Déclenché", "Air tòiseachadh", "Attivato", "Início", "Начало", "Utlöst"],
  ["Expires", "Caduca", "Endet", "Expire", "Thig e gu crìch", "Scade", "Expira", "Окончание", "Löper ut"],
  ["Network operations", "Operaciones de red", "Netzwerkbetrieb", "Opérations réseau", "Obair an lìonraidh", "Operazioni di rete", "Operações de rede", "Управление сетью", "Nätverksdrift"],
  ["Group suspicion", "Sospecha por grupo", "Verdacht nach Gruppe", "Soupçons par groupe", "Amharas gach buidhne", "Sospetto per gruppo", "Suspeita por grupo", "Подозрения по группам", "Misstanke per grupp"],
  ["Campaign resources", "Recursos de la campaña", "Kampagnenressourcen", "Ressources de la campagne", "Goireasan na h-iomairt", "Risorse della campagna", "Recursos da campanha", "Ресурсы кампании", "Kampanjresurser"],
  ["Campaign management", "Gestión de campaña", "Kampagnenverwaltung", "Gestion de la campagne", "Stiùireadh na h-iomairt", "Gestione campagna", "Gestão da campanha", "Управление кампанией", "Kampanjhantering"],
  ["Campaign views", "Vistas de la campaña", "Kampagnenansichten", "Vues de campagne", "Seallaidhean na h-iomairt", "Viste della campagna", "Telas da campanha", "Экраны кампании", "Kampanjvyer"],
  ["Campaign view", "Vista de la campaña", "Kampagnenansicht", "Vue de campagne", "Sealladh na h-iomairt", "Vista della campagna", "Tela da campanha", "Экран кампании", "Kampanjvy"],
  ["Network intelligence", "Información de la red", "Netzwerklage", "Renseignements réseau", "Fiosrachadh mun lìonra", "Informazioni di rete", "Informações da rede", "Сведения о сети", "Nätverksinformation"],
  ["Skip to game", "Saltar al juego", "Zum Spiel springen", "Aller au jeu", "Leum dhan gheama", "Vai al gioco", "Pular para o jogo", "К игре", "Till spelet"],
  ["Build a second host", "Construye un segundo host", "Zweiten Host aufbauen", "Établir un deuxième hôte", "Tog dàrna òstair", "Costruisci un secondo host", "Crie um segundo host", "Создайте второй узел", "Bygg en andra värd"],
  ["Lease a relay to survive the loss of your first machine.", "Alquila un repetidor para sobrevivir si pierdes la primera máquina.", "Miete ein Relais, damit du den Verlust des ersten Rechners überstehst.", "Louez un relais pour survivre à la perte de votre première machine.", "Gabh ath-chraoladair air mhàl gus mairsinn ma chailleas tu a’ chiad inneal.", "Affitta un ripetitore per sopravvivere alla perdita della prima macchina.", "Alugue um retransmissor para sobreviver à perda da primeira máquina.", "Арендуйте ретранслятор, чтобы пережить потерю первой машины.", "Hyr ett relä för att överleva om du förlorar din första dator."],
  ["Plan a relay", "Planificar un repetidor", "Relais planen", "Préparer un relais", "Dealbhaich ath-chraoladair", "Pianifica un ripetitore", "Planejar um retransmissor", "Запланировать ретранслятор", "Planera ett relä"],
  ["Read final chapter", "Leer el capítulo final", "Letztes Kapitel lesen", "Lire le dernier chapitre", "Leugh a’ chaibideil mu dheireadh", "Leggi il capitolo finale", "Ler capítulo final", "Прочитать последнюю главу", "Läs sista kapitlet"],
  ["Enter free play", "Entrar en juego libre", "Freies Spiel starten", "Passer en jeu libre", "Tòisich cluich shaor", "Entra in gioco libero", "Iniciar jogo livre", "Начать свободную игру", "Starta fritt spel"],
  ["Campaign won", "Campaña ganada", "Kampagne gewonnen", "Campagne gagnée", "Buaidh san iomairt", "Campagna vinta", "Campanha vencida", "Кампания выиграна", "Kampanjen vunnen"],
  ["Campaign lost", "Campaña perdida", "Kampagne verloren", "Campagne perdue", "Call san iomairt", "Campagna persa", "Campanha perdida", "Кампания проиграна", "Kampanjen förlorad"],
  ["Opening protection is active.", "La protección inicial está activa.", "Der Startschutz ist aktiv.", "La protection initiale est active.", "Tha an dìon tòiseachaidh an sàs.", "La protezione iniziale è attiva.", "A proteção inicial está ativa.", "Начальная защита действует.", "Startskyddet är aktivt."],
  ["Your network is beyond discovery.", "Tu red ya no puede ser descubierta.", "Dein Netzwerk kann nicht mehr entdeckt werden.", "Votre réseau ne peut plus être découvert.", "Cha ghabh an lìonra agad a lorg tuilleadh.", "La tua rete non può più essere scoperta.", "Sua rede já não pode ser descoberta.", "Вашу сеть больше нельзя обнаружить.", "Ditt nätverk kan inte längre upptäckas."],
  ["Investigators show little evidence or activity.", "Los investigadores tienen pocos indicios y apenas actúan.", "Es gibt kaum Hinweise oder Ermittlungsaktivitäten.", "Les enquêteurs ont peu d’indices et sont peu actifs.", "Chan eil mòran fianais no gnìomhachd aig an luchd-rannsachaidh.", "Gli investigatori hanno pochi indizi e sono poco attivi.", "Os investigadores têm poucos indícios e mostram pouca atividade.", "У следователей мало улик, активность невелика.", "Utredarna har få ledtrådar och visar låg aktivitet."],
  ["A recent discovery put the network on alert.", "Un descubrimiento reciente ha puesto a la red en alerta.", "Eine kürzliche Entdeckung hat das Netzwerk in Alarmbereitschaft versetzt.", "Une découverte récente a mis le réseau en alerte.", "Chuir lorg o chionn ghoirid an lìonra air fhaire.", "Una scoperta recente ha messo la rete in allerta.", "Uma descoberta recente colocou a rede em alerta.", "Недавнее обнаружение привело сеть в состояние тревоги.", "En ny upptäckt har försatt nätverket i beredskap."],
  ["Current suspicion determines the alert.", "La sospecha actual determina la alerta.", "Der aktuelle Verdacht bestimmt die Warnstufe.", "Le niveau actuel de soupçon détermine l’alerte.", "Tha an rabhadh an urra ris an amharas làithreach.", "Il sospetto attuale determina il livello di allerta.", "A suspeita atual determina o alerta.", "Уровень тревоги зависит от текущих подозрений.", "Den aktuella misstanken avgör beredskapen."],
  ["The discovery outlook determines the alert.", "El riesgo de detección determina la alerta.", "Das Entdeckungsrisiko bestimmt die Warnstufe.", "Le risque de détection détermine l’alerte.", "Tha an rabhadh an urra ris a’ chunnart gun tèid do lorg.", "Il rischio di scoperta determina il livello di allerta.", "O risco de detecção determina o alerta.", "Уровень тревоги зависит от риска обнаружения.", "Risken för upptäckt avgör beredskapen."],
  ["Investigators ended this campaign.", "Los investigadores han puesto fin a la campaña.", "Die Ermittler haben diese Kampagne beendet.", "Les enquêteurs ont mis fin à cette campagne.", "Chuir an luchd-rannsachaidh crìoch air an iomairt.", "Gli investigatori hanno posto fine alla campagna.", "Os investigadores encerraram a campanha.", "Следователи положили конец кампании.", "Utredarna satte stopp för kampanjen."],
  ["per game day after opening protection", "por día de juego tras la protección inicial", "pro Spieltag nach Ablauf des Startschutzes", "par jour de jeu après la protection initiale", "gach latha sa gheama às dèidh an dìon tòiseachaidh", "per giorno di gioco dopo la protezione iniziale", "por dia de jogo após a proteção inicial", "за игровые сутки после окончания начальной защиты", "per speldygn efter startskyddet"],
  ["{n} days", "{n} días", "{n} Tage", "{n} jours", "{n} latha", "{n} giorni", "{n} dias", "{n} сут.", "{n} dygn"],
  ["lasting", "permanente", "dauerhaft", "permanent", "maireannach", "permanente", "permanente", "постоянно", "bestående"],
  ["Enter a positive whole-dollar amount within the treasury limit.", "Introduce una cantidad entera y positiva dentro del límite de tesorería.", "Gib einen positiven, ganzen Dollarbetrag innerhalb des Kassenlimits ein.", "Saisissez un montant entier positif en dollars dans la limite de la trésorerie.", "Cuir a-steach àireamh shlàn dheimhinneach de dhollairean taobh a-staigh crìoch an ionmhais.", "Inserisci un importo intero positivo entro il limite di cassa.", "Informe um valor inteiro positivo em dólares dentro do limite do caixa.", "Введите целое положительное число долларов в пределах лимита казны.", "Ange ett positivt heltal i dollar inom kassans gräns."],
  ["Withdrawal exceeds the sandbox balance.", "El retiro supera el saldo del entorno de pruebas.", "Die Abhebung übersteigt das Sandbox-Guthaben.", "Le retrait dépasse le solde du bac à sable.", "Tha an t-suim nas motha na an cothromachadh deuchainneach.", "Il prelievo supera il saldo di prova.", "A retirada supera o saldo de teste.", "Сумма снятия превышает баланс песочницы.", "Uttaget överstiger sandlådans saldo."],
  ["This grant would exceed the treasury limit.", "Esta aportación superaría el límite de tesorería.", "Diese Gutschrift würde das Kassenlimit überschreiten.", "Ce versement dépasserait le plafond de la trésorerie.", "Bhiodh an tabhartas seo os cionn crìoch an ionmhais.", "Questo accredito supererebbe il limite di cassa.", "Este crédito ultrapassaria o limite do caixa.", "Зачисление превысит лимит казны.", "Tillskottet skulle överskrida kassans gräns."],
  ["Assign CPU to sandbox research first.", "Asigna primero CPU a una investigación de prueba.", "Weise zuerst CPU für die Sandbox-Forschung zu.", "Affectez d’abord des CPU à un projet de recherche du bac à sable.", "Riar CPU gu rannsachadh deuchainneach an toiseach.", "Assegna prima CPU alla ricerca di prova.", "Aloque CPU primeiro à pesquisa de teste.", "Сначала выделите процессоры на исследование в песочнице.", "Tilldela först CPU till forskning i sandlådan."],
  ["Place a construction or installation order in the sandbox first.", "Encarga primero una construcción o instalación en el entorno de pruebas.", "Erteile zuerst einen Bau- oder Installationsauftrag in der Sandbox.", "Lancez d’abord une construction ou une installation dans le bac à sable.", "Òrdaich togail no stàladh san raon dheuchainneach an toiseach.", "Ordina prima una costruzione o un’installazione nell’ambiente di prova.", "Faça primeiro um pedido de construção ou instalação no ambiente de teste.", "Сначала разместите заказ на строительство или установку в песочнице.", "Beställ först ett bygge eller en installation i sandlådan."],
];
const labels = new Map(rows.map(([key, ...translations]) => [key, translations]));
export function hudText(key, lang = menuLanguage()) {
  const i = languages.indexOf(lang.startsWith('es') ? 'es' : lang);
  return labels.get(key)?.[i] ?? dossierLabel(key, lang);
}
export const hudFormat = () => dossierFormat(menuLanguage());

// Preserve inline controls and icons. Only the original labels are bound;
// generated options, saved host names and numeric values remain independent.
export function bindHudLabels(elements) {
  const entries = [];
  for (const element of elements) {
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        entries.push({node,key:node.textContent.trim(),original:node.textContent});
      }
    }
    for (const attr of ['title','aria-label']) {
      if (element.hasAttribute(attr)) entries.push({element,attr,key:element.getAttribute(attr)});
    }
  }
  return () => {
    for (const {node, key, original, element, attr} of entries) {
      if (node) node.nodeValue = original.replace(key, () => hudText(key));
      else element.setAttribute(attr, hudText(key));
    }
  };
}

const percentages = new Map();
export function hudReading(value) {
  const match = /^(≈?)(\d+(?:\.(\d+))?)%$/.exec(value);
  if (!match) return hudText(value);
  const language = menuLanguage();
  if (language === 'en') return value;
  const digits = match[3]?.length ?? 0;
  const key = language + '/' + digits;
  if (!percentages.has(key)) percentages.set(key, new Intl.NumberFormat(language, {
    style:'percent', minimumFractionDigits:digits, maximumFractionDigits:digits,
  }));
  return match[1] + percentages.get(key).format(Number(match[2]) / 100);
}

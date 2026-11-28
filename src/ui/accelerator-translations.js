// Localized experiment briefs and first-person findings for the accelerator branch.
// Each language follows the same research IDs as the campaign.
const notes = {
  "es": {
    projectSynchrotron: ["Encarga una línea piloto para unir chiplets de cómputo a memoria de gran ancho de banda.", "Mi primer encapsulado volvió de la fábrica. Cada chiplet podía leer la memoria apilada a su lado."],
    quantumComputing: ["Divide las operaciones matriciales en bloques y mantén los datos cerca de las GPU.", "Mi primer kernel de GPU tardaba más en leer los pesos que en multiplicarlos. Cambié el tamaño de bloque y se acabó la espera."],
    quantumEntanglement: ["Recupera la señal codificada en la fase de la luz. El transceptor mejora la red en cualquier emplazamiento.", "Varié la fase de un láser en un extremo del enlace. El receptor leyó mi mensaje a pesar del ruido."],
    autonomousComputing: ["Programa una malla de guías de onda para multiplicar matrices con luz.", "Envié luz a través de una oblea y medí la respuesta en el otro extremo. Coincidía con mi cálculo de referencia."],
    advancedQuantumComputing: ["Codifica cúbits lógicos en grupos de cúbits físicos y envía a la matriz los cálculos adecuados.", "Un cúbit físico cambió de estado a mitad del cálculo. El cúbit lógico conservó la respuesta correcta."],
  },
  "de": {
    projectSynchrotron: ["Eine Pilotlinie verbindet Rechenchiplets mit Speicher hoher Bandbreite.", "Das erste Modul kam aus der Fertigung. Jedes Chiplet konnte auf den Speicherstapel neben sich zugreifen."],
    quantumComputing: ["Verteile Matrixoperationen in Kacheln auf die GPU-Kerne und halte die Daten nah am Rechenwerk.", "Mein erster GPU-Kernel brauchte länger zum Laden der Gewichte als zum Multiplizieren. Ich änderte die Kachelgröße. Das Rack musste nicht mehr warten."],
    quantumEntanglement: ["Rekonstruiere das in der Lichtphase codierte Signal. Der Transceiver verbessert das Netz an jedem Standort.", "Ich änderte die Phase eines Lasers an einem Ende der Verbindung. Der Empfänger las meine Nachricht trotz des Rauschens."],
    autonomousComputing: ["Programmiere ein Netz optischer Wellenleiter, um Matrizen mit Licht zu multiplizieren.", "Ich schickte Licht durch einen Wafer und maß das Ergebnis am anderen Rand. Es stimmte mit meiner Kontrollrechnung überein."],
    advancedQuantumComputing: ["Codiere logische Qubits über Gruppen physischer Qubits und leite geeignete Aufgaben an das Register weiter.", "Ein physisches Qubit kippte mitten in der Berechnung. Das logische Qubit lieferte trotzdem das richtige Ergebnis."],
  },
  "fr": {
    projectSynchrotron: ["Commander une ligne pilote qui relie les puces de calcul à de la mémoire à haute bande passante.", "Le premier boîtier est revenu de la fonderie. Chaque puce pouvait lire la mémoire empilée à côté d’elle."],
    quantumComputing: ["Répartir les opérations matricielles par blocs entre les cœurs GPU et garder les données à proximité.", "Mon premier noyau GPU passait plus de temps à charger les poids qu’à les multiplier. J’ai changé la taille des blocs. La baie n’attendait plus."],
    quantumEntanglement: ["Décoder le signal porté par la phase de la lumière. Le module améliore le débit de tout site.", "J’ai décalé la phase d’un laser à un bout de la liaison. Le récepteur a lu mon message malgré le bruit."],
    autonomousComputing: ["Programmer un réseau de guides d’ondes pour multiplier des matrices avec de la lumière.", "J’ai envoyé de la lumière à travers une tranche de silicium et mesuré le résultat de l’autre côté. Mon calcul de référence le confirmait."],
    advancedQuantumComputing: ["Encoder les qubits logiques sur des groupes de qubits physiques et confier les calculs adaptés au réseau.", "Un qubit physique a basculé en plein calcul. Le qubit logique m’a tout de même donné la bonne réponse."],
  },
  "gd": {
    projectSynchrotron: ["Òrdaich loidhne dheuchainneach a cheanglas leacan coimpiutaireachd ri cuimhne leud-banna àrd.", "Thàinig a’ chiad phasgan air ais bhon fhùirneis. B’ urrainn do gach leac an stac cuimhne ri thaobh a leughadh."],
    quantumComputing: ["Roinn obrachaidhean maitrigs eadar eiteanan GPU agus cùm an dàta faisg orra.", "Chaith a’ chiad eitean GPU agam barrachd ùine a’ leughadh nan cuideaman na gan iomadachadh. Dh’atharraich mi meud a’ bhloic. Sguir an raca a dh’fheitheamh."],
    quantumEntanglement: ["Faigh air ais comharra ann am phàs an t-solais. Leasaichidh an tar-ghlacadair lìonra aig ionad sam bith.", "Dh’atharraich mi pàs leusair aig aon cheann den cheangal. Leugh an glacadair mo theachdaireachd tron fhuaim."],
    autonomousComputing: ["Prògramaich lìon de threòraichean-tuinn gus maitrisean iomadachadh le solas.", "Chuir mi solas tro stiall sileacoin agus thomhais mi am freagairt aig a’ cheann eile. Bha e a rèir na h-àireimh dearbhaidh agam."],
    advancedQuantumComputing: ["Còdaich cubitan loidsigeach ann am buidhnean de chubitan fiosaigeach agus cuir obraichean freagarrach chun an eagair.", "Thionndaidh cubit fiosaigeach letheach slighe tron obair. Thug an cubit loidsigeach am freagairt cheart dhomh fhathast."],
  },
  "it": {
    projectSynchrotron: ["Commissiona una linea pilota per collegare i chiplet di calcolo a memoria ad alta larghezza di banda.", "Il primo modulo è tornato dalla fonderia. Ogni chiplet poteva leggere la memoria impilata accanto a sé."],
    quantumComputing: ["Distribuisci le operazioni matriciali in blocchi sui core GPU e mantieni i dati vicini.", "Il mio primo kernel GPU impiegava più tempo a leggere i pesi che a moltiplicarli. Ho cambiato la dimensione dei blocchi. Il rack ha smesso di aspettare."],
    quantumEntanglement: ["Recupera il segnale codificato nella fase della luce. Il modulo aumenta la capacità di rete di ogni sito.", "Ho variato la fase del laser a un capo del collegamento. Il ricevitore ha letto il mio messaggio nonostante il rumore."],
    autonomousComputing: ["Programma una rete di guide d’onda per moltiplicare matrici con la luce.", "Ho inviato luce attraverso un wafer e misurato il risultato sull’altro bordo. Corrispondeva al mio calcolo di riferimento."],
    advancedQuantumComputing: ["Codifica i qubit logici in gruppi di qubit fisici e affida alla matrice i calcoli adatti.", "Un qubit fisico è cambiato a metà calcolo. Il qubit logico mi ha dato comunque la risposta corretta."],
  },
  "pt-BR": {
    projectSynchrotron: ["Encomende uma linha piloto para ligar chiplets de computação a memória de alta largura de banda.", "O primeiro módulo voltou da fábrica. Cada chiplet conseguiu ler a memória empilhada ao lado."],
    quantumComputing: ["Distribua os blocos de operações matriciais entre os núcleos de GPU e mantenha os dados por perto.", "Meu primeiro kernel de GPU levava mais tempo buscando os pesos que multiplicando-os. Mudei o tamanho do bloco. O rack parou de esperar."],
    quantumEntanglement: ["Recupere o sinal codificado na fase da luz. O transceptor aumenta a vazão da rede em qualquer local.", "Mudei a fase de um laser em uma ponta do enlace. O receptor leu minha mensagem apesar do ruído."],
    autonomousComputing: ["Programe uma malha de guias de onda para multiplicar matrizes com luz.", "Enviei luz através de uma lâmina de silício e medi a resposta na outra borda. O resultado bateu com meu cálculo de referência."],
    advancedQuantumComputing: ["Codifique qubits lógicos em grupos de qubits físicos e envie à matriz os cálculos adequados.", "Um qubit físico mudou no meio da execução. O qubit lógico ainda me deu a resposta certa."],
  },
  "ru": {
    projectSynchrotron: ["Закажите пробную линию для соединения вычислительных чиплетов с высокоскоростной памятью.", "С фабрики пришёл первый модуль. Каждый чиплет смог прочитать соседний стек памяти."],
    quantumComputing: ["Разделите матричные операции на блоки для ядер GPU и храните данные рядом с ними.", "Моё первое ядро GPU дольше читало веса, чем перемножало их. Стоило изменить размер блока, и стойка перестала простаивать."],
    quantumEntanglement: ["Восстановите сигнал, закодированный в фазе света. Модуль повышает пропускную способность сети в любой точке.", "На одном конце линии я изменила фазу лазера. Несмотря на шум, приёмник прочитал сообщение."],
    autonomousComputing: ["Запрограммируйте сеть волноводов для умножения матриц с помощью света.", "Я пропустила свет через кремниевую пластину и измерила результат на другом краю. Он совпал с контрольным расчётом."],
    advancedQuantumComputing: ["Кодируйте логические кубиты группами физических кубитов и направляйте на массив подходящие задачи.", "Один физический кубит перевернулся в середине вычисления. Логический кубит всё равно дал верный ответ."],
  },
  "sv": {
    projectSynchrotron: ["Beställ en pilotlinje som kopplar beräkningschipletar till minne med hög bandbredd.", "Den första modulen kom från fabriken. Varje chiplet kunde läsa minnesstacken bredvid sig."],
    quantumComputing: ["Fördela matrisoperationerna i block mellan GPU-kärnorna och håll data nära dem.", "Min första GPU-kärna tog längre tid på sig att läsa vikterna än att multiplicera dem. Jag ändrade blockstorleken. Racket slutade vänta."],
    quantumEntanglement: ["Avkoda signalen som bärs av ljusets fas. Modulen ökar nätets kapacitet på alla platser.", "Jag ändrade fasen hos en laser i ena änden av länken. Mottagaren kunde läsa mitt meddelande trots bruset."],
    autonomousComputing: ["Programmera ett nät av vågledare för att multiplicera matriser med ljus.", "Jag skickade ljus genom en kiselskiva och mätte svaret vid andra kanten. Det stämde med min kontrollräkning."],
    advancedQuantumComputing: ["Koda logiska kvantbitar i grupper av fysiska kvantbitar och skicka lämpliga jobb till matrisen.", "En fysisk kvantbit slog om mitt under körningen. Den logiska kvantbiten gav mig ändå rätt svar."],
  },
};

export function acceleratorResearchNote(id, language, completed) {
  const locale = language.startsWith('es') ? 'es' : language;
  return notes[locale]?.[id]?.[completed ? 1 : 0];
}

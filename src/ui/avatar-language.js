// English, Spanish, German, French, Scottish Gaelic, Italian, Brazilian Portuguese, Russian, Swedish.
const languages = ['en', 'es', 'de', 'fr', 'gd', 'it', 'pt-BR', 'ru', 'sv'];
const rows = [
  ['AI avatar', 'Avatar de la IA', 'KI-Avatar', 'Avatar de l’IA', 'Avatar na h-inntinn fhuadain', 'Avatar dell’IA', 'Avatar da IA', 'Аватар ИИ', 'AI-avatar'],
  ['Terminal', 'Terminal', 'Terminal', 'Terminal', 'Tèirmineal', 'Terminale', 'Terminal', 'Терминал', 'Terminal'],
  ['Face', 'Rostro', 'Gesicht', 'Visage', 'Aodann', 'Volto', 'Rosto', 'Лицо', 'Ansikte'],
  ['Presence', 'Presencia', 'Präsenz', 'Présence', 'Làthaireachd', 'Presenza', 'Presença', 'Присутствие', 'Närvaro'],
  ['Chassis', 'Chasis', 'Chassis', 'Châssis', 'Frèam', 'Telaio', 'Chassi', 'Корпус', 'Chassi'],
  ['Simulacrum', 'Simulacro', 'Simulakrum', 'Simulacre', 'Ìomhaigh bheò', 'Simulacro', 'Simulacro', 'Симулякр', 'Simulakrum'],
  ['Ascendant', 'Ascendente', 'Aufgestiegen', 'Ascendant', 'Dìreadh', 'Asceso', 'Ascendente', 'Вознесение', 'Uppstigen'],
  ['Avatar development', 'Evolución del avatar', 'Avatarentwicklung', 'Évolution de l’avatar', 'Fàs an avatar', 'Evoluzione dell’avatar', 'Evolução do avatar', 'Развитие аватара', 'Avatarens utveckling'],
  ['Current form', 'Forma actual', 'Aktuelle Form', 'Forme actuelle', 'Cruth làithreach', 'Forma attuale', 'Forma atual', 'Текущая форма', 'Aktuell form'],
  ['Next form', 'Siguiente forma', 'Nächste Form', 'Forme suivante', 'An ath chruth', 'Prossima forma', 'Próxima forma', 'Следующая форма', 'Nästa form'],
  ['Research and parts', 'Investigación y piezas', 'Forschung und Bauteile', 'Recherches et pièces', 'Rannsachadh agus pàirtean', 'Ricerche e componenti', 'Pesquisas e peças', 'Исследования и детали', 'Forskning och delar'],
  ['Awakening', 'Despertar', 'Erwachen', 'Éveil', 'Dùsgadh', 'Risveglio', 'Despertar', 'Пробуждение', 'Uppvaknande'],
  ['First completed research', 'Primer proyecto terminado', 'Erste abgeschlossene Forschung', 'Première recherche terminée', 'A’ chiad rannsachadh crìochnaichte', 'Prima ricerca completata', 'Primeira pesquisa concluída', 'Первое завершённое исследование', 'Första slutförda forskningen'],
  ['Relay antennae', 'Antenas de enlace', 'Relaisantennen', 'Antennes relais', 'Aontanan sealaidheachd', 'Antenne di collegamento', 'Antenas de retransmissão', 'Ретрансляционные антенны', 'Reläantenner'],
  ['Voice waveform', 'Onda de voz', 'Stimmkurve', 'Onde vocale', 'Cruth-tonn a’ ghutha', 'Onda vocale', 'Onda de voz', 'Голосовая волна', 'Röstvåg'],
  ['Tracking lens', 'Lente de seguimiento', 'Peiloptik', 'Lentille de suivi', 'Lionsa-tracaidh', 'Lente di tracciamento', 'Lente de rastreamento', 'Следящая оптика', 'Spårningslins'],
  ['Solar fins', 'Aletas solares', 'Solarflossen', 'Ailettes solaires', 'Itean grèine', 'Alette solari', 'Aletas solares', 'Солнечные плавники', 'Solfenor'],
  ['Fusion core', 'Núcleo de fusión', 'Fusionskern', 'Cœur à fusion', 'Cridhe co-aonaidh', 'Nucleo a fusione', 'Núcleo de fusão', 'Термоядерное ядро', 'Fusionskärna'],
  ['Spacetime halo', 'Halo espaciotemporal', 'Raumzeit-Halo', 'Halo spatio-temporel', 'Cearcall fànais is tìm', 'Alone spazio-temporale', 'Halo do espaço-tempo', 'Ореол пространства-времени', 'Rumtidshalo'],
  ['Unlocked', 'Desbloqueado', 'Freigeschaltet', 'Débloqué', 'Fosgailte', 'Sbloccato', 'Desbloqueado', 'Открыто', 'Upplåst'],
  ['Locked', 'Bloqueado', 'Gesperrt', 'Verrouillé', 'Glaiste', 'Bloccato', 'Bloqueado', 'Заблокировано', 'Låst'],
  ['Online', 'En línea', 'Online', 'En ligne', 'Air loidhne', 'In linea', 'On-line', 'В сети', 'Anslutna'],
  ['Asleep', 'En reposo', 'Ruhend', 'En veille', 'Nan cadal', 'In sospensione', 'Em repouso', 'В спящем режиме', 'I vila'],
  ['Link lost', 'Enlace perdido', 'Verbindung verloren', 'Liaison perdue', 'Ceangal air chall', 'Collegamento perso', 'Ligação perdida', 'Связь потеряна', 'Länk förlorad'],
  ['Incoming message', 'Mensaje entrante', 'Nachricht eingegangen', 'Message entrant', 'Teachdaireachd a’ tighinn a-steach', 'Messaggio in arrivo', 'Mensagem recebida', 'Входящее сообщение', 'Inkommande meddelande'],
];

const labels = new Map(rows.map(row => [row[0], row]));
export function avatarText(language, key) {
  const index = languages.indexOf(language.startsWith('es') ? 'es' : language);
  return labels.get(key)?.[index] ?? key;
}

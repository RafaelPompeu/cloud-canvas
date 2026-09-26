// Original hand-drawn paths for Cloud Canvas, in a 32 × 32 viewBox.
// Stored emoji characters remain compatible with existing JSON diagrams.
export const emojiDrawings = [
  ['😀','Sorriso','M15 3C31 1 33 28 17 29C1 31-2 5 15 3Z M10 11l.3 2 M22 10l-.2 2 M8 17Q16 19 24 16C22 29 10 27 8 17Z'],
  ['😊','Feliz','M15 3C31 1 33 28 17 29C1 31-2 5 15 3Z M7 13q3-6 6-1 M19 12q3-5 6 0 M10 20q6 7 12-1 M6 17l3 1 M23 17l3-1'],
  ['🚀','Foguete','M11 20C11 10 21 3 29 3C29 13 23 22 15 23Z M12 13L6 14L3 23L11 20 M20 22L19 28L10 30L15 23 M8 24L3 29 M7 28L5 30 M20 8C26 7 27 15 22 16C16 16 16 9 20 8Z'],
  ['☁️','Nuvem','M8 25C0 25 0 14 7 13C5 2 24 0 25 12C34 12 33 25 25 25Q16 26 8 25Z M8 28l14-1'],
  ['💻','Computador','M6 5L27 4L26 23L5 22Z M9 8L24 7L23 19L8 19Z M5 22L2 27Q15 30 30 27L26 23 M12 25l8 .4'],
  ['🗄️','Banco de dados','M5 8C4 1 28 1 27 8C28 15 4 14 5 8Z M5 8L4 25C5 31 27 30 28 24L27 8 M5 16C9 21 23 20 27 16 M5 23C11 27 21 27 28 23'],
  ['🔒','Cadeado','M7 14L26 13L27 29L6 28Z M10 14L10 9C9 0 24 0 23 9L23 13 M16 19q4-1 3 3l-2 3-1-3q-2-1 0-3Z'],
  ['🔑','Chave','M10 4C20 2 23 16 14 19C3 23-1 7 10 4Z M8 8q5-2 5 3q-1 5-5 2Z M18 17L29 27L26 30L23 27L23 24L20 24L17 20'],
  ['✅','Concluído','M5 5L27 4L28 28L4 27Z M8 16L14 22L25 9 M9 17l5 7 12-13'],
  ['❌','Erro','M6 5L27 26 M26 5L5 27 M7 4L28 25 M27 7L7 28'],
  ['⚠️','Atenção','M16 3L30 28L2 27Z M16 11l-.4 9 M16 23l.2 1 M4 29l23 .5'],
  ['💡','Ideia','M11 23C12 18 5 17 6 10C7 0 26 1 26 11C26 18 20 18 21 23Z M11 26l10-.5 M13 29l6 .2 M15 22L13 13L19 13L17 22 M2 7l-1-2 M29 5l2-2'],
  ['🎯','Alvo','M15 3C32 2 33 29 16 30C-1 29-1 4 15 3Z M15 9C26 7 27 24 16 24C5 25 5 9 15 9Z M15 14q6-1 5 5q-5 5-7-1Z M17 16L29 3 M23 3l6-.5 .5 6'],
  ['🔥','Fogo','M16 2C17 11 27 11 28 20C29 33 4 34 4 21C3 16 8 12 9 7L13 14Q18 9 16 2Z M16 17C16 23 22 22 21 27C19 32 10 29 11 25Z'],
  ['📦','Pacote','M3 9L16 3L29 9L28 25L15 30L4 24Z M3 9L16 15L29 9 M16 15L15 30 M10 6L23 12L23 18 M7 20l4 2'],
  ['🌐','Mundo','M16 3C32 2 34 28 17 29C1 31-2 5 16 3Z M15 4C8 11 10 23 17 29 M17 4C24 12 22 22 17 29 M4 15Q16 17 28 15 M7 8Q16 12 25 8 M7 24Q16 20 25 24'],
];
export function emojiDrawing(value){
  return emojiDrawings.find(([emoji])=>emoji.replace(/\uFE0F/g,'')===String(value).trim().replace(/\uFE0F/g,''));
}

// Both axes influence growth. Limit by available space to avoid overflowing
// a short, wide box or a tall, narrow box. No extra persisted state is needed.
export function annotationFontSize(node, item){
  const scale=Math.sqrt(node.w/(item.width||260)*node.h/(item.height||100));
  const availableW=Math.max(1,node.w-28),availableH=Math.max(1,node.h-(node.type==='note'?48:24));
  return Math.max(1,Math.min(14*scale,availableW,availableH*14/20));
}

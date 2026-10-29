// Formatos que o app lê direto e os que ele converte automaticamente.
export const NATIVE = ['pdf', 'epub', 'cbz'];
// Convertidos no próprio aparelho para EPUB (leitura em texto reflowável, com marcação de parágrafos).
export const LOCAL_CONVERT = ['txt', 'md', 'html', 'htm', 'xhtml', 'fb2', 'docx'];
// Exigem o servidor de conversão (server/proxy.js com Calibre, djvulibre ou 7z/unrar).
export const SERVER_CONVERT = { mobi: 'epub', azw: 'epub', azw3: 'epub', lit: 'epub', rtf: 'epub', doc: 'epub', djvu: 'pdf', cbr: 'cbz' };

export const READABLE = [...NATIVE, ...LOCAL_CONVERT, ...Object.keys(SERVER_CONVERT)];
export const extOf = (name) => (name.split('?')[0].split('.').pop() || '').toLowerCase();

// Search, Library, collection folders.
import type { Entry } from "../index";

export const library = {
  "meta.noId": { ar: "لم تُرسل الإضافة معرّف هذا العنوان", en: "the addon did not send this title's identifier", pt: "o addon não informou o identificador deste título" },
  "meta.noType": { ar: "لم تُرسل الإضافة نوع هذا العنوان (فيلم/مسلسل)", en: "the addon did not send this title's type (movie/series)", pt: "o addon não informou o tipo deste título (filme/série)" },

  // Search
  "search.placeholder": { ar: "البحث عن أفلام ومسلسلات…", en: "Search movies, series…", pt: "Buscar filmes, séries…" },
  "search.label": { ar: "البحث", en: "Search", pt: "Buscar" },
  "search.busy": { ar: "جارٍ البحث", en: "Searching", pt: "Buscando" },
  "search.recent": { ar: "عمليات البحث الأخيرة", en: "Recent searches", pt: "Pesquisas recentes" },
  "search.clearHistory": { ar: "مسح السجل", en: "Clear history", pt: "Limpar histórico" },
  "search.removeTerm": { ar: "إزالة «{term}» من السجل", en: "Remove “{term}” from history", pt: "Remover “{term}” do histórico" },
  "search.minLength": { ar: "يُكتب حرفان على الأقل.", en: "Type at least 2 letters.", pt: "Digite ao menos 2 letras." },
  "search.nothing": { ar: "لا نتائج لـ«{query}».", en: "Nothing found for “{query}”.", pt: "Nada encontrado para “{query}”." },

  // Library
  "library.title": { ar: "المكتبة", en: "Library", pt: "Biblioteca" },
  "library.sections": { ar: "أقسام المكتبة", en: "Library sections", pt: "Categorias da Biblioteca" },
  "library.continue": { ar: "متابعة المشاهدة", en: "Continue watching", pt: "Continuar assistindo" },
  "library.favorites": { ar: "المفضّلة", en: "Favorites", pt: "Favoritos" },
  "library.history": { ar: "السجل", en: "History", pt: "Histórico" },
  "library.sortAddedDesc": { ar: "المُضاف حديثًا", en: "Recently added", pt: "Adicionados recentemente" },
  "library.sortAddedAsc": { ar: "المُضاف قديمًا", en: "Added longest ago", pt: "Adicionados há mais tempo" },
  "library.sortTitleAsc": { ar: "العنوان (أ–ي)", en: "Title (A–Z)", pt: "Título (A–Z)" },
  "library.sortTitleDesc": { ar: "العنوان (ي–أ)", en: "Title (Z–A)", pt: "Título (Z–A)" },
  "library.progressFailed": { ar: "تعذّرت قراءة التقدّم: {error}", en: "Could not read progress: {error}", pt: "Não foi possível ler o progresso: {error}" },
  "library.continueEmpty": { ar: "لا شيء قيد المشاهدة. تظهر هنا الأفلام والحلقات التي تبدأ مشاهدتها.", en: "Nothing in progress. Movies and episodes that are started appear here.", pt: "Nada em andamento. Filmes e episódios que você começar a assistir aparecem aqui." },
  "library.favoritesFailed": { ar: "تعذّرت قراءة المفضّلة: {error}", en: "Could not read favorites: {error}", pt: "Não foi possível ler os favoritos: {error}" },
  "library.favoritesEmpty": { ar: "لا توجد أفلام أو مسلسلات محفوظة. يُستخدم ♡ على البطاقات أو في التفاصيل للحفظ.", en: "No saved movies or series. Use ♡ on the cards or in the details to save.", pt: "Nenhum filme ou série salvo. Use ♡ nos cards ou nos detalhes para salvar." },
  "library.sort": { ar: "الترتيب", en: "Sort", pt: "Ordenar" },
  "library.noneOfKind": { ar: "لا عناصر من هذا النوع.", en: "No items of this type.", pt: "Nenhum item deste tipo." },
  "library.showMore": { ar: "عرض المزيد ({count})", en: "Show more ({count})", pt: "Mostrar mais ({count})" },
  "library.historyFailed": { ar: "تعذّرت قراءة السجل: {error}", en: "Could not read history: {error}", pt: "Não foi possível ler o histórico: {error}" },
  "library.historyEmpty": { ar: "لم تُسجَّل أي مشاهدة بعد.", en: "No playback recorded yet.", pt: "Nenhuma reprodução registrada ainda." },
  "library.historyCount": {
    ar: { zero: "لا سجلات", one: "سجل واحد، الأحدث أولًا", two: "سجلان، الأحدث أولًا", few: "{count} سجلات، الأحدث أولًا", many: "{count} سجلًا، الأحدث أولًا", other: "{count} سجل، الأحدث أولًا" },
    en: { one: "{count} entry, most recent first", other: "{count} entries, most recent first" },
    pt: { other: "{count} registro(s), mais recentes primeiro" },
  },
  "library.openDetails": { ar: "فتح التفاصيل", en: "Open details", pt: "Abrir detalhes" },
  "library.resume": { ar: "▶ متابعة", en: "▶ Continue", pt: "▶ Continuar" },
  "library.removeFromHistory": { ar: "إزالة {title} من السجل", en: "Remove {title} from history", pt: "Remover {title} do histórico" },
  "library.removeFromHistoryShort": { ar: "إزالة من السجل", en: "Remove from history", pt: "Remover do histórico" },
  "library.loadMore": { ar: "تحميل المزيد ({count})", en: "Load more ({count})", pt: "Carregar mais ({count})" },

  // Collection folders
  "folder.skippedAll": {
    ar: "تأتي فهارس هذا المجلد من TMDB أو Trakt أو من إضافات غير مثبّتة في هذا الملف الشخصي، ولا يمكن عرضها في موج بعد.",
    en: "This folder's catalogs come from TMDB, Trakt or addons not installed in this profile, and cannot be shown in Mawj yet.",
    pt: "Os catálogos desta pasta vêm do TMDB, do Trakt ou de addons que não estão instalados neste perfil, e ainda não podem ser exibidos no Mawj.",
  },
  "folder.empty": { ar: "لا يحتوي هذا المجلد على فهارس.", en: "This folder has no catalogs.", pt: "Esta pasta não tem catálogos." },
  "folder.tabs": { ar: "فهارس المجلد", en: "Folder catalogs", pt: "Catálogos da pasta" },
  "folder.noTitles": { ar: "لا عناوين في هذا الفهرس.", en: "No titles in this catalog.", pt: "Nenhum título neste catálogo." },
  "folder.skippedSome": {
    ar: { zero: "", one: "فهرس واحد من هذا المجلد يأتي من TMDB أو Trakt أو من إضافات غير مثبّتة ولا يظهر هنا.", two: "فهرسان من هذا المجلد يأتيان من TMDB أو Trakt أو من إضافات غير مثبّتة ولا يظهران هنا.", few: "{count} فهارس من هذا المجلد تأتي من TMDB أو Trakt أو من إضافات غير مثبّتة ولا تظهر هنا.", many: "{count} فهرسًا من هذا المجلد تأتي من TMDB أو Trakt أو من إضافات غير مثبّتة ولا تظهر هنا.", other: "{count} فهرس من هذا المجلد تأتي من TMDB أو Trakt أو من إضافات غير مثبّتة ولا تظهر هنا." },
    en: { one: "{count} catalog of this folder comes from TMDB, Trakt or addons not installed and does not appear here.", other: "{count} catalogs of this folder come from TMDB, Trakt or addons not installed and do not appear here." },
    pt: { other: "{count} catálogo(s) desta pasta vêm do TMDB, do Trakt ou de addons não instalados e não aparecem aqui." },
  },
} satisfies Record<string, Entry>;

// Home, rows, hero, title details, sources, Library marks.
import type { Entry } from "../index";

export const browse = {
  // Home
  "home.addonsFailed": { ar: "تعذّرت قراءة الإضافات: {error}", en: "Could not read the addons: {error}", pt: "Não foi possível ler os addons: {error}" },
  "home.loading": { ar: "جارٍ تحميل الفهارس…", en: "Loading catalogs…", pt: "Carregando catálogos…" },
  "home.empty": {
    ar: "لا توجد فهارس متاحة. تُفعَّل إضافة أو تُضاف من الإعدادات ← الإضافات لعرض الفهارس في الصفحة الرئيسية.",
    en: "No catalogs available. Enable or add an addon in Settings → Addons to see catalogs on the home screen.",
    pt: "Nenhum catálogo disponível. Ative ou adicione um addon em Configurações → Addons para ver catálogos na tela inicial.",
  },

  // Hero carousel
  "hero.carousel": { ar: "عرض دوّار", en: "carousel", pt: "carrossel" },
  "hero.label": { ar: "أبرز العناوين", en: "Highlights", pt: "Destaques" },
  "hero.details": { ar: "عرض التفاصيل", en: "View details", pt: "Ver detalhes" },
  "hero.previous": { ar: "العنوان السابق", en: "Previous highlight", pt: "Destaque anterior" },
  "hero.next": { ar: "العنوان التالي", en: "Next highlight", pt: "Próximo destaque" },
  "hero.choose": { ar: "اختيار عنوان مميّز", en: "Choose highlight", pt: "Escolher destaque" },
  "hero.item": { ar: "العنوان {index}: {name}", en: "Highlight {index}: {name}", pt: "Destaque {index}: {name}" },

  // Catalog rows
  "row.loadFailed": { ar: "تعذّر تحميل هذا الفهرس ({error}).", en: "Could not load this catalog ({error}).", pt: "Não foi possível carregar este catálogo ({error})." },

  // Continue watching
  "cw.title": { ar: "متابعة المشاهدة", en: "Continue watching", pt: "Continuar assistindo" },
  "cw.nextOf": { ar: "الحلقة التالية من {title}", en: "Next episode of {title}", pt: "Próximo episódio de {title}" },
  "cw.resume": { ar: "متابعة {title}", en: "Continue {title}", pt: "Continuar {title}" },
  "cw.airs": { ar: "يُعرض في {date}", en: "Airs on {date}", pt: "Estreia em {date}" },
  "cw.nextEpisode": { ar: "الحلقة التالية", en: "Next episode", pt: "Próximo episódio" },
  "cw.removeFrom": { ar: "إزالة {title} من متابعة المشاهدة", en: "Remove {title} from Continue watching", pt: "Remover {title} de Continuar assistindo" },
  "cw.dateTbd": { ar: "موعد لم يُحدَّد", en: "date to be announced", pt: "data a definir" },

  // Favorites
  "fav.remove": { ar: "إزالة من المكتبة", en: "Remove from Library", pt: "Remover da Biblioteca" },
  "fav.add": { ar: "حفظ في المكتبة", en: "Save to Library", pt: "Salvar na Biblioteca" },
  "fav.failed": { ar: "تعذّر الحفظ. تُعاد المحاولة.", en: "Could not save. Try again.", pt: "Não foi possível salvar. Tente de novo." },
  "fav.inLibrary": { ar: "في المكتبة", en: "In Library", pt: "Na Biblioteca" },
  "fav.save": { ar: "حفظ", en: "Save", pt: "Salvar" },

  // Details
  "details.openFailed": { ar: "تعذّر فتح التفاصيل: {error}", en: "Could not open the details: {error}", pt: "Não foi possível abrir os detalhes: {error}" },
  "details.loading": { ar: "جارٍ تحميل التفاصيل…", en: "Loading details…", pt: "Carregando detalhes…" },
  "details.director": { ar: "الإخراج: {names}", en: "Director: {names}", pt: "Direção: {names}" },
  "details.resumeFrom": { ar: "▶ المتابعة من {time}", en: "▶ Continue from {time}", pt: "▶ Continuar de {time}" },
  "details.fromStart": { ar: "المشاهدة من البداية", en: "Watch from the start", pt: "Assistir do início" },
  "details.watch": { ar: "▶ مشاهدة", en: "▶ Watch", pt: "▶ Assistir" },
  "details.resumeEpisode": { ar: "▶ متابعة {code} · {time}", en: "▶ Continue {code} · {time}", pt: "▶ Continuar {code} · {time}" },
  "details.trailerLoading": { ar: "جارٍ تحميل الإعلان…", en: "Loading trailer…", pt: "Carregando trailer…" },
  "details.trailer": { ar: "▶ مشاهدة الإعلان", en: "▶ Watch trailer", pt: "▶ Assistir trailer" },
  "details.trailerSubtitle": { ar: "إعلان · {name}", en: "Trailer · {name}", pt: "Trailer · {name}" },
  "details.by": { ar: "التفاصيل من {addon}", en: "Details from {addon}", pt: "Detalhes por {addon}" },
  "details.ageRating": { ar: "التصنيف العمري", en: "Rating", pt: "Classificação" },
  "details.status": { ar: "الحالة", en: "Status", pt: "Situação" },
  "details.writer": { ar: "التأليف", en: "Writers", pt: "Roteiro" },
  "details.country": { ar: "البلد", en: "Country", pt: "País" },
  "details.language": { ar: "اللغة", en: "Language", pt: "Idioma" },
  "details.awards": { ar: "الجوائز", en: "Awards", pt: "Prêmios" },
  "details.website": { ar: "الموقع", en: "Website", pt: "Site" },
  "details.playFailed": { ar: "تعذّر التشغيل: {error}", en: "Playback failed: {error}", pt: "Falha ao reproduzir: {error}" },
  "details.specials": { ar: "حلقات خاصة", en: "Specials", pt: "Especiais" },
  "details.season": { ar: "الموسم {season}", en: "Season {season}", pt: "Temporada {season}" },
  "details.cast": { ar: "طاقم التمثيل", en: "Cast", pt: "Elenco" },
  "details.sources": { ar: "المصادر", en: "Sources", pt: "Fontes" },
  "details.resumeNote": { ar: " · يُتابَع من {time}", en: " · continues from {time}", pt: " · continua de {time}" },
  "details.closeSources": { ar: "إغلاق المصادر", en: "Close sources", pt: "Fechar fontes" },

  // Sources
  "streams.failed": { ar: "تعذّر جلب المصادر: {error}", en: "Could not fetch sources: {error}", pt: "Falha ao buscar fontes: {error}" },
  "streams.loading": { ar: "جارٍ البحث عن المصادر في الإضافات…", en: "Searching the addons for sources…", pt: "Buscando fontes nos addons…" },
  "streams.none": { ar: "لا توجد إضافة مثبّتة توفّر مصادر لهذا العنوان.", en: "No installed addon provides sources for this title.", pt: "Nenhum addon instalado fornece fontes para este título." },
  "streams.groupError": { ar: "خطأ: {error}", en: "error: {error}", pt: "erro: {error}" },
  "streams.count": {
    ar: { zero: "لا مصادر", one: "مصدر واحد", two: "مصدران", few: "{count} مصادر", many: "{count} مصدرًا", other: "{count} مصدر" },
    en: { one: "{count} source", other: "{count} sources" },
    pt: { other: "{count} fonte(s)" },
  },
  "streams.source": { ar: "مصدر", en: "Source", pt: "Fonte" },
  "streams.pendingDebrid": { ar: "Debrid — غير مدعوم بعد في هذا الإصدار", en: "Debrid — not supported yet in this version", pt: "Debrid — ainda não suportado nesta versão" },
  "streams.pendingExternal": { ar: "رابط خارجي — يُفتح خارج المشغّل", en: "External link — opens outside the player", pt: "Link externo — abre fora do player" },
  "streams.pendingYouTube": { ar: "YouTube — غير مدعوم بعد في هذا الإصدار", en: "YouTube — not supported yet in this version", pt: "YouTube — ainda não suportado nesta versão" },
} satisfies Record<string, Entry>;

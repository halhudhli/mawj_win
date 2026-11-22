// App shell, sidebar, shared formatting and account status.
import type { Entry } from "../index";

export const app = {
  "app.name": { ar: "موج", en: "Mawj", pt: "Mawj" },
  "app.unknownError": { ar: "خطأ غير معروف", en: "unknown error", pt: "erro desconhecido" },
  "app.switchFailed": { ar: "تعذّر تبديل الملف الشخصي: {error}", en: "Could not switch profile: {error}", pt: "Não foi possível trocar de perfil: {error}" },
  "app.openFailed": { ar: "تعذّر فتح «{name}»: {reason}.", en: "Could not open “{name}”: {reason}.", pt: "Não foi possível abrir “{name}”: {reason}." },
  "app.switching": { ar: "جارٍ التبديل إلى {name}…", en: "Switching to {name}…", pt: "Trocando para {name}…" },
  "app.switchingOther": { ar: "ملف شخصي آخر", en: "another profile", pt: "outro perfil" },
  "app.bootFailed": { ar: "تعذّرت قراءة بيانات موج: {error}", en: "Could not read Mawj data: {error}", pt: "Não foi possível ler os dados do Mawj: {error}" },
  "app.addonsFailed": {
    ar: { zero: "لم تستجب {count} من {total} إضافات؛ البقية متاحة.", one: "لم تستجب إضافة واحدة من {total}؛ البقية متاحة.", two: "لم تستجب إضافتان من {total}؛ البقية متاحة.", few: "لم تستجب {count} إضافات من {total}؛ البقية متاحة.", many: "لم تستجب {count} إضافة من {total}؛ البقية متاحة.", other: "لم تستجب {count} إضافة من {total}؛ البقية متاحة." },
    en: { one: "{count} of {total} addons did not respond; the others are available.", other: "{count} of {total} addons did not respond; the others are available." },
    pt: { other: "{count} de {total} addon(s) não responderam; os demais estão disponíveis." },
  },

  // Sidebar
  "nav.main": { ar: "التنقل الرئيسي", en: "Main navigation", pt: "Navegação principal" },
  "nav.home": { ar: "الرئيسية", en: "Home", pt: "Início" },
  "nav.tv": { ar: "البث المباشر", en: "Live TV", pt: "TV" },
  "nav.search": { ar: "البحث", en: "Search", pt: "Buscar" },
  "nav.library": { ar: "المكتبة", en: "Library", pt: "Biblioteca" },
  "nav.settings": { ar: "الإعدادات", en: "Settings", pt: "Configurações" },
  "nav.switchProfile": { ar: "{name} · تبديل الملف الشخصي", en: "{name} · switch profile", pt: "{name} · trocar de perfil" },

  // Shared words
  "common.back": { ar: "رجوع", en: "Back", pt: "Voltar" },
  "common.close": { ar: "إغلاق", en: "Close", pt: "Fechar" },
  "common.cancel": { ar: "إلغاء", en: "Cancel", pt: "Cancelar" },
  "common.save": { ar: "حفظ", en: "Save", pt: "Salvar" },
  "common.remove": { ar: "إزالة", en: "Remove", pt: "Remover" },
  "common.retry": { ar: "إعادة المحاولة", en: "Try again", pt: "Tentar novamente" },
  "common.previous": { ar: "السابق", en: "Previous", pt: "Anterior" },
  "common.next": { ar: "التالي", en: "Next", pt: "Próximo" },
  "common.loading": { ar: "جارٍ التحميل…", en: "Loading…", pt: "Carregando…" },
  "common.on": { ar: "مفعّل", en: "On", pt: "Ativado" },
  "common.off": { ar: "معطّل", en: "Off", pt: "Desativado" },
  "common.never": { ar: "أبدًا", en: "never", pt: "nunca" },
  "common.later": { ar: "لاحقًا", en: "Later", pt: "Depois" },
  "common.confirm": { ar: "تأكيد", en: "Confirm", pt: "Confirmar" },
  "common.continue": { ar: "متابعة", en: "Continue", pt: "Continuar" },
  "common.delete": { ar: "حذف", en: "Delete", pt: "Excluir" },
  "common.edit": { ar: "تعديل", en: "Edit", pt: "Editar" },
  "common.done": { ar: "تم", en: "Done", pt: "Concluído" },
  "common.all": { ar: "الكل", en: "All", pt: "Todos" },
  "common.none": { ar: "لا شيء", en: "None", pt: "Nenhum" },
  "common.default": { ar: "الافتراضي", en: "Default", pt: "Padrão" },
  "common.saved": { ar: "تم الحفظ", en: "Saved", pt: "Salvo" },
  "common.saving": { ar: "جارٍ الحفظ…", en: "Saving…", pt: "Salvando…" },
  "common.saveFailed": { ar: "تعذّر الحفظ: {error}", en: "Could not save: {error}", pt: "Não foi possível salvar: {error}" },

  // Media types (labels the addons' types)
  "type.movie": { ar: "أفلام", en: "Movies", pt: "Filmes" },
  "type.series": { ar: "مسلسلات", en: "Series", pt: "Séries" },
  "type.anime": { ar: "أنمي", en: "Anime", pt: "Anime" },
  "type.channel": { ar: "قنوات", en: "Channels", pt: "Canais" },
  "type.tv": { ar: "تلفاز", en: "TV", pt: "TV" },
  "type.one.movie": { ar: "فيلم", en: "Movie", pt: "Filme" },
  "type.one.series": { ar: "مسلسل", en: "Series", pt: "Série" },
  "type.one.anime": { ar: "أنمي", en: "Anime", pt: "Anime" },
  "type.one.channel": { ar: "قناة", en: "Channel", pt: "Canal" },
  "type.one.tv": { ar: "تلفاز", en: "TV", pt: "TV" },

  // Times and progress
  "time.left": { ar: "متبقٍّ {minutes} د", en: "{minutes} min left", pt: "faltam {minutes} min" },
  "time.leftHours": { ar: "متبقٍّ {hours} س {minutes} د", en: "{hours} h {minutes} min left", pt: "faltam {hours} h {minutes} min" },
  "time.today": { ar: "اليوم، {time}", en: "today, {time}", pt: "hoje, {time}" },
  "time.yesterday": { ar: "أمس، {time}", en: "yesterday, {time}", pt: "ontem, {time}" },
  "time.watched": { ar: "شوهد {time}", en: "{time} watched", pt: "{time} assistidos" },
  "time.completed": { ar: "✓ تمت المشاهدة", en: "✓ Watched", pt: "✓ Assistido" },
  "episode.code": { ar: "م{season} ح{episode}", en: "S{season} E{episode}", pt: "T{season} E{episode}" },

  // Account status (Settings → Account, sync badge)
  "sync.syncing": { ar: "جارٍ المزامنة…", en: "Syncing…", pt: "Sincronizando…" },
  "sync.pending": {
    ar: { zero: "لا تغييرات بانتظار الإرسال", one: "تغيير واحد بانتظار الإرسال", two: "تغييران بانتظار الإرسال", few: "{count} تغييرات بانتظار الإرسال", many: "{count} تغييرًا بانتظار الإرسال", other: "{count} تغيير بانتظار الإرسال" },
    en: { one: "{count} change waiting to be sent", other: "{count} changes waiting to be sent" },
    pt: { other: "{count} alteração(ões) aguardando envio" },
  },
  "sync.offline": { ar: "لا يوجد اتصال — حُفظت التغييرات لإرسالها لاحقًا", en: "Offline — changes kept to send later", pt: "Sem conexão — alterações guardadas para enviar depois" },
  "sync.error": { ar: "خطأ في المزامنة", en: "Sync error", pt: "Erro de sincronização" },
  "sync.needsReview": { ar: "تلزم مراجعة المزامنة الأولى", en: "Review the first sync", pt: "Revise a primeira sincronização" },
  "sync.expired": { ar: "انتهت الجلسة", en: "Session expired", pt: "Sessão expirada" },
  "sync.signedOut": { ar: "غير متصل بالحساب", en: "Signed out", pt: "Desconectado" },
  "sync.notConfigured": { ar: "الحساب غير متاح في هذا الإصدار", en: "Account unavailable in this version", pt: "Conta indisponível nesta versão" },
  "sync.ok": { ar: "تمت المزامنة", en: "Synced", pt: "Sincronizado" },
} satisfies Record<string, Entry>;

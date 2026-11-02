import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Denetimler, son tarihler ve arızalar doğrudan yapay zekâ asistanınızda.",
  "intro": "SparxDeck MCP, firmanızın kayıtlarını açık standart Model Context Protocol üzerinden Claude, ChatGPT veya Gemini gibi yapay zekâ asistanlarına bağlar. Günlük dille sorarsınız, asistan gerçek verilerinizden yanıt verir.",
  "connectTitle": "Nasıl bağlanılır",
  "address": "Sunucu adresi",
  "steps": [
    "Firma sahibi, SparxDeck uygulamasında Yapay zekâ asistanları bölümünden asistanları açar. Veri değişikliklerine ayrıca izin verir.",
    "Asistanınızda yukarıdaki adresle özel bir bağlayıcı (uzak MCP sunucusu) ekleyin.",
    "SparxDeck'e giriş yapın, firmayı seçin ve erişime izin verin. Erişimi istediğiniz zaman iptal edebilirsiniz."
  ],
  "note": "OAuth ile giriş yapmayan asistanları uygulamada oluşturduğunuz kişisel bir belirteçle bağlarsınız.",
  "toolsTitle": "Asistan neler yapabilir",
  "readTitle": "Okuma",
  "readGroups": [
    "Genel bakış ve son tarihler",
    "Binalar ve müşteriler",
    "Cihazlar",
    "Denetimler ve özetler",
    "Arızalar ve planlanan ziyaretler",
    "Arama ve listeler"
  ],
  "writeTitle": "Değişiklikler, yalnızca sahibi izin verirse",
  "writeBody": "Her değişiklik iki adımlıdır: asistan önce bir önizleme gösterir ve değişikliği ancak siz açıkça onayladıktan sonra yapar.",
  "writeGroups": [
    "Arızalar",
    "Ziyaret planı",
    "Notlar"
  ],
  "extras": "Kaynaklar (firma, cihaz türleri, bina, cihaz, arıza ve denetim ayrıntıları) ve hazır talimatlar da vardır: önümüzdeki günler için plan, müşteri için rapor, bina ziyareti hazırlığı ve açık arızaların gözden geçirilmesi.",
  "securityTitle": "Güvenlik",
  "security": [
    "Varsayılan olarak kapalıdır. Firma sahibi açar ve değişikliklere ayrıca izin verir.",
    "Asistan, onu bağlayan üyeyle aynı haklara sahiptir ve uygulamadakiyle aynı veri erişim kuralları geçerlidir.",
    "Her değişikliği açıkça onaylamanız gerekir. Hiçbir şey silinmez ve rapor düzenlenmez.",
    "Teknisyenlerin konumu ve evleri asistana asla gösterilmez.",
    "Kayıtlardaki metinler asistana talimat olarak değil, veri olarak işaretlenmiş şekilde ulaşır.",
    "Her çağrı kaydedilir (kim, ne zaman, hangi araç) ve özeti uygulamada görürsünüz.",
    "Çağrı sayısı sınırlıdır, belirteçlerin süresi dolar ve bağlantıyı istediğiniz zaman iptal edebilirsiniz."
  ],
  "technicalTitle": "Teknik ayrıntılar",
  "technical": [
    "Streamable HTTP üzerinden Model Context Protocol 2026-07-28; 2025 tarihli eski istemciler de desteklenir.",
    "PKCE (S256) ile OAuth 2.1, dinamik istemci kaydı ve Client ID Metadata Documents, bu sunucuya bağlı belirteçler (RFC 8707).",
    "Yetki kapsamları sparxdeck:read ve sparxdeck:write.",
    "Araçların açıklamaları, girdi ve çıktı şemaları, ek bilgileri (salt okunur, yıkıcı, eş güçlü) ve sayfalaması vardır."
  ]
};

export default mcp;

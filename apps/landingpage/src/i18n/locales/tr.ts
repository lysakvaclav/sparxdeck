import type { Dictionary } from "../types";
import home from "../home/tr";
import { SITE } from "@/config/site";
import { locales } from "../config";

const tr: Dictionary = {
  common: {
    backToHome: "Ana sayfaya dön",
  },
  header: {
    product: "Ürün",
    signIn: "Giriş yap",
    getStarted: "Hemen başla",
    bookDemo: "Demo talep et",
    company: "Şirket",
    workWithUs: "Bizimle çalışın",
    mission: "Misyonumuz",
    team: "Ekip",
    newsroom: "Haberler",
    careers: "Kariyer",
    megaContactLabel: "İletişim",
  },
  home,
  footer: {
    allRightsReserved: "Tüm hakları saklıdır.",
    cookiesSettings: "Çerezler",
    termsOfService: "Kullanım koşulları",
    privacyPolicy: "Gizlilik politikası",
    companyHeading: "Şirket",
    mission: "Misyonumuz",
    team: "Ekip",
    newsroom: "Haberler",
    workWithUs: "Bizimle çalışın",
    careers: "Kariyer",
  },
  pages: {
    mission: {
      heading: "Misyonumuz",
      subheading: "Teknisyenin zamanını kâğıtlarla değil, ekipmanların başında geçirmesini istiyoruz.",
      body: [
        "Yangın güvenliği ekipmanlarının kontrolleri binalardaki insanları korur. Buna rağmen birçok servis firmasında bu kontroller hâlâ yirmi yıl önceki gibi yapılıyor: teknisyen binayı dolaşır, her şeyi kâğıda yazar ve akşam saatlerce notları tutanağa aktarır. Sonraki kontrollerin tarihleri Excel'de ya da akılda tutulur.",
        "Bu zamana, paraya ve sinirlere mal olur. Unutulan bir kontrol kaybedilen bir iş, okunaksız bir not tutanakta bir hata demektir; bir olaydan sonra neyin ne zaman kontrol edildiğini kanıtlamak ise zordur.",
        "SparxDeck bunu değiştiriyor. Teknisyen QR kodu tarar, kontrol listesini işaretler ve tutanak hazırdır. Şirket tüm ekipmanları, arızaları ve tarihleri görür; her kontrol bir sonraki işe dönüşür. Bir başka karmaşık kurumsal sistem geliştirmiyoruz. Birkaç dakikada öğrenilen ve insanların keyifle kullandığı bir araç geliştiriyoruz.",
      ],
    },
    about: {
      heading: "SparxDeck hakkında",
      subheading: "Yangın güvenliği alanındaki servis firmaları için yazılım.",
      body: [
        "SparxDeck, yangın güvenliği ekipmanlarını düzenli olarak kontrol eden firmalar için bir web ve mobil uygulamadır: yangın söndürücüler, hidrantlar, acil aydınlatma, yangın damperleri ve kapıları. Kâğıt notları ve Excel'i tek, anlaşılır bir sistemle değiştirir.",
        `SparxDeck Çekya'da doğdu ve farklı ülkelerde çalışmak için tasarlandı. Uygulamanın çekirdeği her yerde aynıdır; dil ve rapor şablonları değişir. Uygulama şimdilik Çekçe ve İngilizce, bu web sitesi ${locales.length} dilde.`,
        "Ürünü servis firmaları ve sahadaki teknisyenlerle yakın iş birliği içinde geliştiriyoruz. İşinizi daha da kolaylaştıracak bir fikriniz varsa bize yazın.",
      ],
    },
    team: {
      heading: "SparxDeck ekibi",
      subheading: "Kontrol yapan firmalar için basit yazılım geliştiren ekip.",
    },
    careers: {
      heading: "Kariyer",
      subheading:
        "Şu anda açık pozisyonumuz bulunmuyor. Modernleşmeye ihtiyaç duyan bir sektör için yazılım geliştirmek ilginizi çekiyorsa bize yazın.",
    },
    news: {
      heading: "Haberler",
      subheading: "Henüz haber yok. Ürünle ilgili ilk güncellemeler yakında burada olacak.",
    },
    equipmentRegister: {
      heading: "Ekipman kaydı ve QR etiketler",
      subheading: "Tüm müşteriler, binalar ve ekipmanlar tek bir yerde",
      body: [
        "SparxDeck'te müşterileri, binalarını ve her bir cihazı anlaşılır bir yapıda yönetirsiniz: yangın söndürücüler, hidrantlar, acil aydınlatma, yangın damperleri ve kapıları. Her cihaz için türünü, konumunu, son kontrol tarihini ve tüm geçmişini görürsünüz. Klasörlerde ya da aynı tablonun farklı sürümlerinde arama yapmaya son.",
        "Uygulama her cihaz için bir QR etiket yazdırır. Teknisyen bunu ilk ziyarette yapıştırır; sonrasında hangi cihazın önünde durduğunu ve ne yapması gerektiğini bilmek için tek bir tarama yeterlidir. Excel'deki mevcut kayıtlarınızı birkaç tıklamayla içe aktarırsınız.",
      ],
    },
    fieldInspections: {
      heading: "Telefonla sahada kontrol",
      subheading: "Tara, işaretle, bitti",
      body: [
        "Teknisyen cihazdaki QR kodu tarar ve o ekipman türü için hazırlanmış kontrol listesini işaretler; örneğin yangın söndürücü için basınç, mühür, hasar ve geçerlilik süresi. Her madde basit bir evet/hayırdır; bu sayede kontrol bir an sürer ve hiçbir şey unutulmaz.",
        "Teknisyen bir arıza bulursa fotoğrafını doğrudan uygulamada çeker. Uygulama bodrumda veya teknik odada sinyal olmadan çalışır ve telefon yeniden çevrimiçi olur olmaz veriler senkronize edilir. Özel bir ekipman ya da uzun bir eğitim gerekmez.",
      ],
    },
    inspectionReports: {
      heading: "Tutanak daha sahadayken hazır",
      subheading: "Ekranda imza ve logonuzu taşıyan otomatik PDF",
      body: [
        "Kontrol tamamlandığında SparxDeck, teknisyenin sahada kaydettiği her şeyden otomatik olarak bir PDF tutanak oluşturur. Müşteri bunu doğrudan telefon ekranında imzalar. Tutanakta şirketinizin logosu ve bilgileri, kontrol edilen ekipmanların listesi, sonuçlar ve tespit edilen arızalar yer alır.",
        "Raporu müşteriye tek dokunuşla e-postayla gönderirsiniz ve sistemde kayıtlı kalır. Görünümünü şablon düzenleyicisinde ayarlarsınız ve düzenlenen bir rapor bir daha asla değişmez. Hangi müşteride neyin ne zaman denetlendiğini, örneğin bir resmi denetimde veya sigorta hasarında, her zaman bulursunuz.",
      ],
    },
    deadlineTracking: {
      heading: "Kontrol tarihlerinin takibi",
      subheading: "Hiçbir tarih kaçmaz ve her kontrol bir sonraki işi getirir",
      body: [
        "SparxDeck her cihazın bir sonraki kontrolünün ne zaman olduğunu bilir. Gelecek ay nelerin süresinin dolacağını tek bir yerde görürsünüz ve sistem yaklaşan kontrolleri size zamanında hatırlatır. Tarihleri artık Excel'de ya da aklınızda tutmanıza gerek yok.",
        "Bir servis firması için bu, tekrarlayan işlerin düzenli bir akışı anlamına gelir. Saha ziyaretlerini önceden planlayabilir, müşteriye rakiplerinizden önce ulaşabilir ve yalnızca bir tarih unutulduğu için iş kaybetmezsiniz.",
      ],
    },
    defectTracking: {
      heading: "Arızalar kontrol altında",
      subheading: "Tespit edilen her arıza, çözülene kadar takip edilen bir göreve dönüşür",
      body: [
        "Teknisyen kontrol sırasında bir arıza bulduğunda SparxDeck bunu otomatik olarak fotoğraf ve açıklama içeren bir göreve dönüştürür. Arıza notlar arasında kaybolmaz ve kimin sorumlu olduğu bellidir.",
        "Her arızada durumu (açık, işlemde, giderildi), kimin ilgilendiğini ve ne zamana kadar olduğunu görürsünüz. Giderme bir not gerektirir ve tüm değişiklik geçmişi kayıtlı kalır. Bulunan sorunların gerçekten çözüldüğünü bilir, bir sonraki iş için de dayanağınız olur.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "SparxDeck web sitesi ve uygulamasının kullanım koşulları (bilgilendirme amaçlı özettir, hukuki danışmanlık değildir).",
      body: [
        `Bu koşullar, yangın güvenliği ekipmanlarının kaydı ve kontrolü için bir web ve mobil uygulama olan ${SITE.name} web sitesi ve uygulamasının kullanımını düzenler. Kayıt olarak veya uygulamayı kullanarak bu koşulları kabul etmiş olursunuz. Uygulamayı bir şirket adına kullanıyorsanız, buna yetkili olduğunuzu onaylarsınız.`,
        "Uygulama aylık abonelikle sunulur. Fiyat, geçerli fiyat listesine veya bireysel teklife göre belirlenir ve teknisyen ya da cihaz sayısına bağlıdır. Aboneliğinizi istediğiniz zaman, ödenmiş dönemin sonunda geçerli olmak üzere iptal edebilirsiniz.",
        "Giriş bilgilerinizden ve hesabınızdaki kullanıcıların faaliyetlerinden siz sorumlusunuz. Uygulamaya girdiğiniz veriler, özellikle müşteri kayıtları, ekipmanlar, fotoğraflar ve tutanaklar size aittir. Bunları yalnızca hizmeti sunmak için işleriz ve talep ettiğinizde dışa aktarım olarak size teslim ederiz.",
        "SparxDeck bir kayıt ve belgeleme aracıdır. Kontrollerin profesyonel şekilde yapılması ve tutanaklardaki bilgilerin doğruluğu konusundaki sorumluluk servis firmasına ve onun yetkin teknisyenlerine aittir.",
        "Hizmetin sürekli erişilebilir ve güvenli olması için çaba gösteririz, ancak her zaman kesintisiz ve hatasız çalışacağını garanti edemeyiz. Yasaların izin verdiği ölçüde sorumluluğumuz, son 12 ayda ödenen abonelik ücretleriyle sınırlıdır.",
        `${SITE.name} yazılımı, tasarımı ve markası telif hakkı ve diğer fikri mülkiyet haklarıyla korunmaktadır. Uygulamanın kötüye kullanılması, güvenlik önlemlerinin aşılması veya yasalara aykırı şekilde kullanılması yasaktır.`,
        `Bu koşullar Çek Cumhuriyeti yasalarına tabidir. Koşulları zaman zaman değiştirebiliriz ve önemli değişiklikleri size önceden e-postayla bildiririz. Sorularınız için ${SITE.email} adresine yazın.`,
      ],
    },
    privacy: {
      subheading:
        "SparxDeck web sitesinde ve uygulamasında kişisel verileri nasıl işlediğimiz (bilgilendirme amaçlı özettir, hukuki değerlendirme değildir).",
      body: [
        `Kullanıcıların ve web sitesi ziyaretçilerinin kişisel verilerinin veri sorumlusu ${SITE.name} hizmetinin işletmecisidir. Veri koruma ile ilgili sorularınız için ${SITE.email} adresinden bize ulaşın.`,
        "Hesap bilgilerinizi (ad, e-posta, telefon, şirket), fatura bilgilerinizi, güvenli çalışma için gereken teknik verileri (IP adresi, cihaz türü, giriş kayıtları) ve örneğin demo talep ederken bize kendiniz gönderdiğiniz bilgileri işleriz.",
        "Bir servis firmasının müşterileri, binaları, ekipmanları ve kontrolleri hakkında uygulamaya girdiği verileri, fotoğraflar ve imzalar dahil, o firma adına veri işleyen sıfatıyla işleriz. Bu işlemenin koşulları, aboneliğin bir parçası olan veri işleme sözleşmesiyle belirlenir.",
        "Verileri hizmeti sunmak ve sözleşmeyi ifa etmek, yasal yükümlülükleri (örneğin muhasebe) yerine getirmek, meşru menfaat (güvenlik, kötüye kullanımın önlenmesi, hizmetin geliştirilmesi) temelinde ve pazarlama iletişimleri için açık rızanız temelinde işleriz.",
        "Veriler, bulut altyapısı, e-posta ve ödeme hizmeti sağlayıcıları gibi güvenilir tedarikçiler tarafından da her zaman GDPR'ye uygun koruma sağlayan sözleşmeler çerçevesinde işlenebilir. Avrupa Ekonomik Alanı dışına aktarımlarda Avrupa Komisyonu'nun standart sözleşme hükümlerini uygularız. Kişisel verileri satmayız.",
        "Verileri hesabınız var olduğu sürece, sonrasında ise yalnızca yasal yükümlülükleri yerine getirmek veya haklarımızı korumak için gereken süre boyunca saklarız. Abonelik sona erdiğinde, talep üzerine şirketinizin verilerini dışa aktarır ve ardından sileriz.",
        "Kişisel verilerinize erişme, bunları düzeltme, silme, işlemeyi kısıtlama, taşıma ve işlemeye itiraz etme haklarına sahipsiniz. Rızanızı istediğiniz zaman geri çekebilirsiniz. Ayrıca veri koruma denetim makamına şikâyette bulunma hakkınız vardır.",
      ],
    },
    cookies: {
      subheading: "SparxDeck web sitesi ve uygulamasının kullandığı çerezler ve benzeri teknolojiler.",
      body: [
        `${SITE.name} web sitesi ve uygulaması yalnızca çalışmaları için gerekli olan çerezleri kullanır. Üçüncü tarafların reklam veya izleme çerezlerini kullanmayız ve davranışlarınız hakkındaki bilgileri satmayız.`,
        "Uygulamadaki gerekli çerezler oturumunuzu açık tutar ve hesabınızı kötüye kullanıma karşı korur. Web sitesinde tarayıcınızda yalnızca açık veya koyu tema tercihinizi saklarız. Dil, sayfa adresine göre belirlenir.",
        "Analiz araçları veya zorunlu olmayan başka çerezler kullanmaya başlarsak, önceden onayınızı ister ve bu sayfayı güncelleriz.",
        "Çerezleri istediğiniz zaman tarayıcı ayarlarınızdan, genellikle Gizlilik veya Güvenlik bölümünden silebilir ya da engelleyebilirsiniz. Ancak gerekli çerezler olmadan uygulamaya giriş yapamazsınız.",
        `Çerez kullanımıyla ilgili sorularınız için ${SITE.email} adresine yazın.`,
      ],
    },
  },
};

export default tr;

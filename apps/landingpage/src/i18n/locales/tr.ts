import type { Dictionary } from "../types";
import { SITE } from "@/config/site";
import { locales } from "../config";

const tr: Dictionary = {
  common: {
    backToHome: "Ana sayfaya dön",
  },
  header: {
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
  hero: {
    heading: "Yangın güvenliği kontrolleri.\nKâğıt işi olmadan.",
    body:
      "SparxDeck, yangın güvenliği ekipmanlarını kontrol eden servis firmaları için geliştirilmiş bir uygulamadır. Teknisyen QR kodu tarar, kontrol listesini işaretler ve tutanak müşteriye otomatik olarak gönderilir. Sonraki kontrollerin tarihlerini Excel tablosu değil, sistem takip eder.",
    primaryCta: "Hemen başla",
    secondaryCta: "Nasıl çalışır",
  },
  companies: {
    cards: [
      {
        title: "Ekipman kaydı ve QR etiketler",
        description:
          "Müşteriler, binalar ve tüm ekipmanlar tek bir yerde: yangın söndürücüler, hidrantlar, acil aydınlatma, yangın damperleri ve yangın kapıları. SparxDeck QR etiketleri yazdırır ve her cihazın tüm kontrol geçmişini içeren kendi kartı olur.",
      },
      {
        title: "Telefonla sahada kontrol",
        description:
          "Teknisyen QR kodu tarar ve kısa bir kontrol listesini işaretler: basınç, mühür, hasar, geçerlilik süresi. Arızayı anında fotoğraflar. Uygulama sinyal olmadan da çalışır; bodrumda ya da teknik odada.",
      },
      {
        title: "Tutanak daha sahadayken hazır",
        description:
          "Müşteri doğrudan ekranda imzalar ve şirketinizin logosunu taşıyan PDF tutanak hemen e-postayla kendisine gönderilir. Akşamları notları yeniden yazmakla geçen saatler sona erer.",
      },
      {
        title: "Kontrol tarihlerinin takibi",
        description:
          "Gelecek ay nelerin süresinin dolacağını görün ve yaklaşan kontroller için hatırlatmalar alın. Hiçbir tarih kaçmaz ve her kontrol bir sonraki işi getirir.",
      },
      {
        title: "Arızalar kontrol altında",
        description:
          "Tespit edilen her arıza, giderilene kadar takip ettiğiniz bir göreve dönüşür. Bina yöneticisi ekipmanlarının durumunu müşteri portalında görür.",
      },
    ],
    headingLine1: "Karmaşık kurumsal sistemler yok.",
    headingLine2: "Sadece teknisyenin gerçekten ihtiyaç duyduğu şeyler.",
    paragraph:
      "SparxDeck bilerek basit tasarlandı. Birkaç dakikada öğrenilir, teknisyenler kendi telefonlarında kullanır ve siz nihayet tüm işlerin, ekipmanların ve tarihlerin net bir görünümüne sahip olursunuz.",
    cardCta: "Daha fazla bilgi",
  },
  comparison: {
    title: "Kâğıt ve Excel karşısında SparxDeck",
    subtitle:
      "Defter, klasör ve tabloların yerini tek bir uygulama aldığında kontrolün her adımının nasıl değiştiğini görün.",
    oldLabel: "Kâğıt ve Excel",
    newLabel: "SparxDeck",
    rows: [
      {
        topic: "Kontrol notları",
        old: "Kâğıda elle yazılır, çoğu zaman okunaksız ve hatalıdır",
        new: "QR kod taraması ve kısa kontrol listesi doğrudan telefonda",
      },
      {
        topic: "Tutanak",
        old: "Akşamları saatlerce Word veya Excel'e aktarma",
        new: "Logonuzu ve müşteri imzasını taşıyan PDF, daha sahadayken hazır",
      },
      {
        topic: "Kontrol tarihleri",
        old: "Tablo, takvim ya da hafıza",
        new: "Otomatik genel bakış ve önceden hatırlatmalar",
      },
      {
        topic: "Arızalar",
        old: "Kolayca kaybolan bir kenar notu",
        new: "Çözülene kadar takip edilen, fotoğraflı bir görev",
      },
      {
        topic: "Ekipman geçmişi",
        old: "Ofiste klasörler ve dosyalarda arama",
        new: "Her cihazın tüm geçmişi tek dokunuşla",
      },
      {
        topic: "Müşteri",
        old: "Tutanağı bekler ve ekipmanının durumunu bilmez",
        new: "Tutanağı hemen e-postayla alır ve durumu müşteri portalında görür",
      },
    ],
  },
  radar: {
    title: "Tüm kontrol döngüsü tek bir sistemde",
    subtitle:
      "Ekipman kaydından sahadaki kontrole, imzalı tutanaktan bir sonraki tarihe kadar. SparxDeck, servis firmalarının normalde kâğıt, Excel ve e-postalarla bir araya getirdiği tüm döngüyü kapsar.",
    labels: ["Kayıt", "QR etiketler", "Kontrol", "Tutanaklar", "Tarihler", "Arızalar"],
    keyAreasHeading: "SparxDeck neleri kapsar",
    keyAreas: [
      {
        title: "Kayıt",
        description:
          "Her türden müşteri, bina ve ekipman, eksiksiz kontrol geçmişiyle tek bir yerde.",
      },
      {
        title: "QR etiketler",
        description:
          "Etiketleri doğrudan uygulamadan yazdırın. Tek bir tarama ve teknisyen hangi cihazın önünde durduğunu bilir.",
      },
      {
        title: "Kontrol",
        description:
          "Her ekipman türü için kontrol listesi, tek dokunuşla arıza fotoğrafı ve sinyal olmadan tam işlevsellik.",
      },
      {
        title: "Tutanaklar",
        description:
          "Logonuzu ve müşteri imzasını taşıyan, kontrolün hemen ardından gönderilen PDF tutanak.",
      },
      {
        title: "Tarihler",
        description: "Gelecek ay yapılması gereken kontrollere genel bakış ve zamanında hatırlatmalar.",
      },
      {
        title: "Arızalar",
        description: "Her arıza, çözülene kadar takip edilen, durumu olan bir görevdir.",
      },
    ],
    howItWorksHeading: "SparxDeck ile kontrol nasıl yapılır",
    howItWorks: [
      "Ofiste müşteriyi, binayı ve ekipmanları oluşturur ya da mevcut tablonuzdan içe aktarırsınız.",
      "QR etiketleri yazdırırsınız; teknisyen ilk ziyarette bunları ekipmanlara yapıştırır.",
      "Sonraki her kontrolde teknisyen etiketi tarar ve kontrol listesini telefonunda işaretler.",
      "Bir arıza bulursa fotoğrafını çeker ve sistemde otomatik olarak bir görev oluşturulur.",
      "Müşteri ekranda imzalar, tutanak e-postayla kendisine gönderilir ve sistem bir sonraki kontrol tarihini belirler.",
    ],
    resultHeading: "Neler kazanırsınız",
    result: [
      "Kâğıt notları tutanaklara aktarmadan geçen akşamlar.",
      "Unutulan hiçbir kontrol, dolayısıyla kaybedilen hiçbir iş yok.",
      "Sistemin sizin yerinize takip ettiği tekrarlayan işler.",
      "Denetim veya olay durumunda profesyonel tutanaklar ve izlenebilir geçmiş.",
    ],
  },
  faq: {
    headingLine1: "Sıkça sorulan sorular",
    headingLine2: "",
    items: [
      {
        id: "who",
        question: "SparxDeck kimler için?",
        answer:
          "Binaları dolaşarak yangın güvenliği ekipmanlarını kontrol eden, genellikle 3 ila 30 çalışanı olan servis firmaları için. Teknisyenler sahada telefonla, ofis bilgisayarla, bina yöneticileri ise kendi müşteri portallarında çalışır.",
      },
      {
        id: "equipment",
        question: "SparxDeck hangi ekipmanları destekliyor?",
        answer:
          "Yangın söndürücüler, hidrantlar, acil aydınlatma, yangın damperleri ve yangın kapıları. Her ekipman türünün kendi kontrol listesi vardır; böylece teknisyen tam olarak gerekeni kontrol eder.",
      },
      {
        id: "offline",
        question: "Uygulama sinyal olmadan çalışır mı?",
        answer:
          "Evet. Teknisyen bodrumda veya teknik odada bağlantı olmadan çalışabilir. Telefon yeniden çevrimiçi olur olmaz veriler otomatik olarak senkronize edilir.",
      },
      {
        id: "pricing",
        question: "SparxDeck'in fiyatı nedir?",
        answer:
          "Teknisyen veya cihaz sayısına göre aylık abonelik ödersiniz; böylece fiyat şirketinizle birlikte büyür. Kısa bir demo talep edin, size özel bir teklif hazırlayalım.",
      },
      {
        id: "protocols",
        question: "Tutanaklar mevzuata uygun mu?",
        answer:
          "Evet. Tutanak şablonları, SparxDeck'in faaliyet gösterdiği her ülkedeki yerel kontrol gerekliliklerine dayanır. Her tutanakta şirketinizin logosu ve bilgileri ile müşterinin imzası bulunur.",
      },
      {
        id: "portal",
        question: "Bina yöneticisi ekipmanlarının durumunu görebilir mi?",
        answer:
          "Evet. Bina yöneticileri ve sahiplerinin kendi müşteri portalı vardır; burada ekipmanların durumunu, açık arızaları ve tarihleri görür, tüm tutanakları indirebilirler.",
      },
      {
        id: "onboarding",
        question: "Kullanmayı öğrenmek ne kadar sürer?",
        answer:
          "Birkaç dakika. SparxDeck yalnızca en önemli şeyleri içerir; bu yüzden teknisyen ilk kontrolü eğitim almadan yapar. Excel'deki mevcut kayıtlarınızı birkaç tıklamayla içe aktarırsınız.",
      },
    ],
  },
  getStarted: {
    primaryCta: "SparxDeck ile başlayın",
    secondaryCta: "Demo talep edin",
  },
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
        `SparxDeck Çekya'da doğdu ve farklı ülkelerde çalışacak şekilde tasarlandı. Uygulamanın çekirdeği her yerde aynıdır; yalnızca dil ve tutanak şablonları yerel mevzuata göre değişir. Uygulama ${locales.length} dilde kullanılabilir.`,
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
        "Tutanak hemen e-postayla müşteriye gönderilir, sistemde saklanır ve bina yöneticisi tarafından istenildiği zaman kendi portalından indirilebilir. Tutanak şablonları yerel mevzuata uygundur. Neyin, ne zaman ve hangi müşteride kontrol edildiğini her zaman öğrenebilirsiniz; örneğin resmi bir denetimde ya da sigorta hasarında.",
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
        "Her arızanın bir durumu vardır: yeni, işlemde, çözüldü. Bina yöneticisi açık arızaları kendi müşteri portalında görür ve sorunların gerçekten giderildiğinden emin olur; siz ise bir sonraki iş için sağlam bir zemine sahip olursunuz.",
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

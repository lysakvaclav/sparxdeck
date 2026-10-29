import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Yangın güvenliği ekipmanı denetimleri için yazılım",
    "title": "Yangın ekipmanı denetimleri.",
    "titleMuted": "Kâğıt ve yeniden yazma olmadan.",
    "body": "SparxDeck, yangın söndürücüleri, hidrantları, acil aydınlatmayı, yangın damperlerini ve yangın kapılarını denetleyen servis firmaları için bir uygulamadır. Teknisyen QR etiketini tarar, kontrolü telefonda işaretler ve rapor daha sahadayken hazır olur. Sonraki denetim tarihlerini Excel yerine sistem takip eder.",
    "primary": "SparxDeck ile başlayın",
    "secondary": "Demo ayarlayın",
    "note": "Bilgisayarda ve telefonda tarayıcıda çalışır. Kurulum gerekmez."
  },
  "facts": [
    {
      "value": "1 tarama",
      "label": "ve teknisyen cihaz kartını ve kontrol listesini görür"
    },
    {
      "value": "Sinyalsiz",
      "label": "kontrol ve günün planı bodrumda veya kazan dairesinde de çalışır"
    },
    {
      "value": "Sahada PDF",
      "label": "müşteri imzalı rapor, kontrolden hemen sonra"
    },
    {
      "value": "Birkaç dakika",
      "label": "tam günlük eğitim yerine teknisyenin alışması için"
    }
  ],
  "platform": {
    "eyebrow": "Platform",
    "title": "Bir denetim firmasının ihtiyacı olan her şey. Fazlası değil.",
    "body": "Ekipman kaydından sahadaki kontrole, imzalı rapora, arızalara ve bir sonraki tarihe kadar. Ofis ve teknisyenler için tek bir sistem.",
    "learnMore": "Daha fazla bilgi"
  },
  "features": [
    {
      "label": "Ekipman kaydı",
      "title": "Müşteriler, binalar ve ekipman tek yerde",
      "body": "Yangın söndürücüler, hidrantlar, acil aydınlatma, damperler ve kapılar; konum, seri numarası ve tüm denetim geçmişiyle. Mevcut tablonuzu Excel'den içe aktarın, QR etiketlerini doğrudan uygulamadan yazdırın."
    },
    {
      "label": "Saha kontrolü",
      "title": "Tara, işaretle, bitti",
      "body": "Teknisyen etiketi tarar ve o ekipman türünün kontrol listesini izler, arızaları fotoğraflar. Sinyal yoksa kontrol telefonda bekler ve bağlantı gelince gönderilir."
    },
    {
      "label": "Raporlar",
      "title": "Rapor, ayrılmadan hazır",
      "body": "Firmanızın logosu ve müşterinin imzasıyla bir PDF, kontrolden hemen sonra oluşur ve tek dokunuşla e-postayla gönderilir. Raporun görünümünü şablon düzenleyicisinde ayarlarsınız. Düzenlenen bir rapor bir daha asla değişmez."
    },
    {
      "label": "Tarihler",
      "title": "Hiçbir denetim gözden kaçmaz",
      "body": "Takvim neyin ne zaman dolduğunu ve kimin nereye gittiğini gösterir. 30, 60 ve 90 günlük görünüm ve haftalık e-posta özeti tarihleri sizin yerinize takip eder."
    },
    {
      "label": "Arızalar",
      "title": "Arızalar giderilene kadar takipte",
      "body": "Uygun olmayan bir kontrol maddesi kendiliğinden fotoğraf, önem derecesi, sorumlu kişi ve süreyle bir arızaya dönüşür. Her değişiklik geçmişe kaydedilir."
    },
    {
      "label": "Harita ve rotalar",
      "title": "Binalar haritada, ziyaretler mesafeye göre",
      "body": "Harita tüm binaların durumunu gösterir. Rota günün ziyaretlerini sıralar ve denetimi yakında dolacak yakındaki binaları önerir. Mesafeler kuş uçuşudur, bu bir navigasyon değildir."
    }
  ],
  "principles": {
    "eyebrow": "Neden SparxDeck",
    "title": "Saha çalışması için tasarlandı",
    "items": [
      {
        "title": "Basit",
        "body": "Yalnızca bir teknisyenin gerçekten ihtiyaç duyduğu şeyler. Karmaşık bir kurumsal sistem yok, uzun eğitim yok."
      },
      {
        "title": "Sinyalsiz çalışır",
        "body": "Kontroller, fotoğraflar ve günün planı telefonda bekler ve bağlantı olunca gönderilir."
      },
      {
        "title": "Verileriniz sizindir",
        "body": "Her firma yalnızca kendi verilerini görür. İstediğiniz zaman CSV'ye aktarım; düzenlenen raporlar değişmeden kalır."
      }
    ]
  },
  "steps": {
    "eyebrow": "Nasıl çalışır",
    "title": "Beş adımda bir denetim",
    "items": [
      "Müşterileri, binaları ve ekipmanı eklersiniz ya da mevcut tablonuzdan içe aktarırsınız.",
      "QR etiketlerini yazdırırsınız; teknisyen ilk ziyarette ekipmana yapıştırır.",
      "Her kontrolde teknisyen etiketi tarar ve listeyi telefonda işaretler.",
      "Uygun olmayan bir madde, fotoğraf ve süreyle arıza olarak kaydedilir.",
      "Müşteri ekranda imzalar, rapor e-postayla gider ve sistem bir sonraki tarihi belirler."
    ]
  },
  "comparison": {
    "eyebrow": "Karşılaştırma",
    "title": "Kâğıt ve Excel vs. SparxDeck",
    "body": "Defterler, klasörler ve tablolar yerini tek bir uygulamaya bıraktığında denetimin her adımı nasıl değişir.",
    "oldLabel": "Kâğıt ve Excel",
    "newLabel": "SparxDeck",
    "rows": [
      {
        "topic": "Kontrol kaydı",
        "old": "Kâğıda elle, çoğu zaman okunaksız",
        "new": "QR etiket taraması ve telefonda liste"
      },
      {
        "topic": "Rapor",
        "old": "Akşamları Word veya Excel'e yeniden yazma",
        "new": "Sahada müşteri imzalı PDF"
      },
      {
        "topic": "Denetim tarihleri",
        "old": "Tablo, takvim veya hafıza",
        "new": "Dolan tarihlerin görünümü ve haftalık özet"
      },
      {
        "topic": "Arızalar",
        "old": "Kenara düşülen ve kaybolan not",
        "new": "Fotoğraf, sorumlu kişi ve süreli arıza"
      },
      {
        "topic": "Ekipman geçmişi",
        "old": "Klasörler ve dosyalarda arama",
        "new": "Bir cihazın tüm geçmişi tek dokunuşla"
      },
      {
        "topic": "Ziyaret planlama",
        "old": "Hafızadan ve deneyimle",
        "new": "Takvim, bina haritası ve günlük rota"
      }
    ]
  },
  "faq": {
    "eyebrow": "SSS",
    "title": "Sık sorulan sorular",
    "body": "Cevabınızı bulamadınız mı? Bize yazın, SparxDeck'i size memnuniyetle gösteririz.",
    "items": [
      {
        "question": "SparxDeck kimler için?",
        "answer": "Yangın güvenliği ekipmanını denetleyen ve test eden, genellikle 3 ila 30 kişilik servis firmaları için. Teknisyenler sahada telefonla, ofis bilgisayarla çalışır."
      },
      {
        "question": "SparxDeck hangi ekipmanları destekler?",
        "answer": "Yangın söndürücüler, hidrantlar, acil aydınlatma, yangın damperleri ve yangın kapıları. Ekipman türlerini ve kontrol maddelerini kendiniz uyarlarsınız; böylece teknisyen tam olarak gerekeni kontrol eder."
      },
      {
        "question": "Uygulama sinyalsiz çalışır mı?",
        "answer": "Evet. Başlanmış bir denetim ve günün planı telefona kaydedilir. Kontroller, fotoğraflar ve ziyaret edilen binalar orada bekler ve bağlantı olunca gönderilir."
      },
      {
        "question": "Raporu uyarlayabilir miyim?",
        "answer": "Evet. Şablon düzenleyicisinde blokları, metinleri, logoyu, yazı tipini ve rengi ayarlarsınız. Raporun mevzuata göre ne içermesi gerektiğine firmanız karar verir; uygulama kural uydurmaz. Düzenlenen bir rapor artık değişmez."
      },
      {
        "question": "Mevcut kayıtlarımı nasıl aktarırım?",
        "answer": "Müşterileri, binaları ve ekipmanı bir Excel veya CSV dosyasından içe aktarırsınız. Uygulama sütunları tanır, kaydetmeden önce önizleme gösterir ve içe aktarma geri alınabilir."
      },
      {
        "question": "SparxDeck ne kadar?",
        "answer": "Fiyat firmanızın büyüklüğüne göre belirlenir ve bir sözleşmeye dayalı olarak banka havalesiyle ödenir. Kısa bir demo ayarlayın, size bir teklif hazırlayalım."
      },
      {
        "question": "Alışmak ne kadar sürer?",
        "answer": "Birkaç dakika. Teknisyen ilk kontrolü eğitimsiz yapar ve uygulamada her şeyi denemek için örnek veriler vardır."
      }
    ]
  },
  "cta": {
    "title": "SparxDeck'i firmanızda deneyin",
    "body": "Bir hesap oluşturun ve uygulamayı örnek verilerle keşfedin ya da kısa bir demo ayarlayın.",
    "primary": "SparxDeck ile başlayın",
    "secondary": "Demo ayarlayın"
  },
  "shots": {
    "dashboard": "Tarihler, arızalar ve bugünkü rotayla SparxDeck genel görünümü",
    "devices": "Etiketler, konumlar ve denetim tarihleriyle ekipman listesi",
    "check": "Telefonda bir yangın söndürücü kontrolü",
    "protocol": "PDF önizlemeli rapor şablonu düzenleyicisi",
    "calendar": "Planlanmış denetimlerin takvimi",
    "defects": "Önem derecesi ve süresiyle arıza listesi",
    "map": "Tarih durumuna göre bina haritası",
    "route": "Haritada, mesafeye göre sıralanmış teknisyen rotası",
    "today": "Teknisyenin bugünkü planı telefonda"
  }
};

export default home;

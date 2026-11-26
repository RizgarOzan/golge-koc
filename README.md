# Gölge Koç

Telefonun kamerasıyla seni izleyen, sesli kombinasyon söyleyen ve ne yaptığına bakıp tavsiye veren bir kickboks antrenörü. Uygulama mağazasına gerek yok: tarayıcıda açılan bir web uygulaması (PWA), istersen ana ekrana ekleyip uygulama gibi kullanırsın.

Hemen denemek için telefonda şu adresi aç: **https://rizgarozan.github.io/golge-koc/**

## Ne yapıyor

- Seviyeye göre (1-3) kombinasyon seçip Türkçe sesle söylüyor: "cab, kros, sağ low kick" gibi.
- Kamerada iskeletini MediaPipe ile takip ediyor, hangi elle ya da ayakla ne attığını çıkarıyor: düz yumruk, kroşe, aparkat, low/middle/high kick, diz.
- Her komut için tepki süreni ölçüyor, doğru hareketi doğru taraftan atıp atmadığına bakıyor, vururken boştaki elin düşüyor mu ve kombinasyondan sonra gardına dönüyor musun onu kontrol ediyor.
- Raund bitince kısa bir özet ve birkaç somut tavsiye veriyor ("Sağ ve solu karıştırıyorsun", "Komut beklerken elin aşağıda" gibi).
- Ortodoks ya da solak duruş seçilebiliyor; solakta taraflar kendiliğinden ters çevriliyor.
- Görüntü telefondan çıkmıyor. Bütün hesap cihazın üzerinde yapılıyor.

## Modlar

**Kombinasyon.** Eski usul: kombinasyonu söylüyorum, sen atıyorsun, ben bakıyorum.

**Savunma** (eskiden "Savaş"). Burada karşında rakip varmış gibi davranıyorum. "Jab geliyor!", "Kroşe geliyor!", "Low kick geliyor!" diye bağırıyorum ve saldırının "gelmesine" seviyeye göre 1,3 / 1,0 / 0,8 saniye kalıyor. O sürede doğru savunmayı yapman lazım:

- jab ya da kros gelirse kafanı yana kaydır ya da iki elinle kapan,
- kroşe gelirse dizlerinden çökerek eğil ya da kapan,
- jab-kros gelirse bunlardan herhangi biri,
- low kick gelirse bacağını kaldırıp kontrol et.

Savunma tutarsa hemen kısa bir karşılık kombinasyonu söylüyorum, onu da puanlıyorum. Hiç savunma yapmazsan "Yedin!" diyorum, yanlış savunma yaparsan (jab'a eğilmek gibi) neyin doğru olduğunu ekrana yazıyorum. Belden eğildiğini görürsem onu da ayrıca söylüyorum; dizden çökmek hem daha güvenli hem karşılığa daha hızlı geçiriyor. Raund sonunda savunma oranını, ortalama savunma tepki süreni ve karşılıkların doğruluğunu görüyorsun.

**Hızlı refleks.** Tek tek vuruş komutları ve habersiz saldırılar karışık, kısa ve düzensiz aralarla geliyor. Saldırılar burada biraz daha hızlı. Amaç düşünmeden tepki vermek.

**Kum torbası.** Kamera yok, sadece ses. Torbanın başına geçiyorsun, ben kombinasyon söylüyorum: "Sol sağ düz", "Sol sağ düz, sol kroşe", "Sağ sağ düz, sol low kick". Kombinasyon uzadıkça bekleme de uzuyor. Arada 30-50 saniyede bir "Seri kroşe!" gibi 10 saniyelik hızlı seriler geliyor. Raund aralarında torba çalışmasına dair tek cümlelik bir hatırlatma söylüyorum. Kamera olmadığı için vuruşları ölçmüyorum; tekniğe bakmamı istiyorsan aynı kombinasyonları Kombinasyon modunda kameraya at.

**Rakipli shadow.** Kamerayla izliyorum ve hayali bir rakibi ben oynuyorum. Komutların aşağı yukarı yarısı rakibin saldırısı, yarısı senin atman gereken kombinasyon. Saldırıyı "Sağ düz geldi", "Sol kroşe geldi" diye söylüyorum ve ekranda kırmızı yazıyorum; "geldi" yoksa sıra sende. Seviye 2'den sonra "Sol low sağ high kick geldi" gibi seriler de geliyor; serideki her saldırıya ayrı savunma bekliyorum. High kick'e kapanmak ya da eğilmek, middle kick'e kapanmak ya da bacağı kaldırmak sayılıyor. Savunma tutarsa karşılık istiyorum. Raund sonunda o raundu 10 puan sistemiyle puanlıyorum: doğru attığın her vuruş ve tuttuğun her savunma sana 1 puan, yediğin her saldırı rakibe 2 puan, geç kalan her savunma rakibe 1 puan yazılıyor. "Raundu kazandın, 10-9" gibi söylüyorum, maç sonunda da maçın sonucunu ve raund raund tabloyu gösteriyorum. Bu bir oyun hakemliği: rakip gerçek değil, puan da sadece tanıyıcının gördükleriyle hesaplanıyor.

Bütün modlarda raund sayısı (1, 3, 5) ve raund süresi seçilebiliyor. Raund aralarında seviyeye göre dinlenme var; dinlenmede bir önceki raundla ilgili kısa bir not söylüyorum, 10 saniye kala uyarıyorum. Komutları "Sol / sağ düz" ya da "Jab / kros" diye söyletmek ayarlardan seçiliyor.

## Program

Ana ekranda haftada 3, 4 ya da 5 gün için bir program kurulabiliyor. Hafta kombinasyon, kum torbası, savunma ve shadow günlerinden oluşuyor; iki haftada bir raund sayısı artıyor. "Bugünün antrenmanı" sıradaki seansı başlatıyor, biten seanslar o haftanın kutucuklarında işaretleniyor.

Koç geçmiş seanslarına göre ayarlanıyor. Son seanslarda zayıf kalan bir hareket ya da savunamadığın bir saldırı varsa, onu içeren kombinasyonlar ve saldırılar üç kat daha sık geliyor ve program kartında "Odak" diye yazıyor. Aynı seviyedeki son üç kameralı seans iyi giderse seviye atlamanı, kötü giderse düşürmeni öneriyor; kum torbası seansları buna sayılmıyor. Hepsi telefonda, `localStorage` içinde duruyor; sunucu yok.

## Savunmayı nasıl tanıyorum

Savunmayı şöyle tanıyorum: kafanın yere basan ayağa göre ne kadar alçaldığına (eğilme), kalçaya göre ne kadar yana kaydığına (kayma) ve iki bileğin burun hizasına kalkıp kalkmadığına (kapanma) bakıyorum. Low kick kontrolü için ayrı bir şey yok, bacağın yerden kalkması yetiyor. Yumruk atarken de kafa oynadığı için, ilk başta bir vuruşla üst üste binen her savunma hareketini atıyordum. Bunu eklemeden önce yumruk videolarında savunma tanıyıcı sürekli yanlış alarm veriyordu; bir videoda 930 yumruğa karşı 707 sahte savunma çıktı. Filtreden sonra 6-12 dakikalık dört yumruk videosunda sahte savunma sayısı video başına 8 ile 60 arasına indi. Ama gerçek kayma videosunda bu filtrenin doğru savunmaları da sildiğini gördüm (aşağıda anlatıyorum), o yüzden şimdi daha yumuşak: üst üste binen bir vuruş savunmayı ancak kafa az oynadıysa, kol sert bir yumruk kadar açıldıysa ya da bacak low kick'ten yükseğe kalktıysa siliyor. Bir de kafa yüksekliğini önce iki ayağın ortasından ölçüyordum; low kick atarken kalkan ayak ortalamayı aşağı çektiği için tekme eğilme gibi görünüyordu. Artık yere basan, yani alttaki ayaktan ölçüyorum.

Dosyalar:

- `index.html`, `app.js`: arayüz, kamera, ses, raund akışı.
- `analyzer.js`: hareket tanıma ve puanlama. Tarayıcıya bağlı değil, Node ile test ediliyor.
- `coach.js`: program, zayıf nokta seçimi, raund hakemliği, kum torbası kombinasyonları. O da saf fonksiyonlardan oluşuyor.
- `test/`: sentetik iskeletlerle ve koç fonksiyonlarıyla testler. Çalıştırmak için `node --test test/`.
- `manifest.webmanifest`, ikonlar: ana ekrana ekleme için.

## Telefonda nasıl çalışır

Kamera izni tarayıcılarda yalnızca HTTPS üzerinden veriliyor, o yüzden dosyaları bir yere koyup HTTPS adresinden açmak gerekiyor. En kolayı GitHub Pages: dosyaları bir repoya atıp Pages'i açınca `https://kullanici.github.io/golge-koc/` gibi bir adres çıkıyor. Netlify ya da Cloudflare Pages da aynı işi görür.

Bilgisayarda denemek için `python -m http.server 8765` yeterli; `localhost` HTTPS sayılıyor.

**iPhone (Safari):** adresi Safari'de aç, Paylaş > Ana Ekrana Ekle. Birkaç bilinen dert var:

- Sessiz mod düğmesi açıksa sesli komutlar duyulmayabiliyor. Sessizi kapat.
- Ses ilk dokunuştan sonra açılıyor, o yüzden "Başla" düğmesine basmak şart.
- Ana ekrandan açılan uygulamada kamera bazen siyah kalıyor ya da her açılışta yeniden izin istiyor (WebKit'te açık hatalar var). Olursa aynı adresi doğrudan Safari'de açmak çoğu zaman çözüyor.
- Ekranın kararmaması (Wake Lock) iOS 18.4 ve sonrasında düzgün çalışıyor.

**Android (Chrome):** adresi aç, menüden "Ana ekrana ekle" ya da "Uygulamayı yükle". Kamera ve ses burada daha sorunsuz.

Telefonu 2-3 metre öteye, bütün vücudun ayaktan başa kadar kadraja girecek şekilde koy. Önden ya da hafif çapraz açı en iyisi.

## Mağazasız gerçek uygulama istersen

Web sürümü yetmezse seçenekler şunlar:

- **Android:** Capacitor ya da TWA ile APK üretip doğrudan telefona kurmak kolay, mağaza gerekmiyor.
- **iPhone, ücretsiz:** Xcode ve ücretsiz Apple hesabıyla kendi telefonuna kurabilirsin ama 7 günde bir yeniden imzalamak gerekiyor. AltStore ya da SideStore bunu otomatikleştiriyor.
- **iPhone, AB'de:** alternatif uygulama pazarları var.
- **iPhone, ücretli:** yıllık 99 dolarlık geliştirici hesabıyla TestFlight; mağazaya çıkmadan 90 günlük sürümler dağıtılabiliyor.

## Piyasada benzerleri

Baktığım kadarıyla üç gruba ayrılıyorlar:

- **Sadece komut söyleyenler** (FightFlow, Punchy, ComboPunch, ShadowBox gibi): kombinasyon okuyorlar ama ne yaptığını görmüyorlar.
- **Kamerayla yumruk sayanlar** (Punch AI, ROUNDS): kamera kullanıyorlar ama tekme ve diz yok, gard ve tepki süresi kontrolü de yok ya da sınırlı.
- **Sensörlü ürünler** (FightCamp, Liteboxer, Corner, PunchLab, Strike Force gibi): eldiven ya da torba sensörüyle çok daha isabetli ölçüyorlar, ama para ve ekipman istiyorlar.

Komut söyleyip kamerayla tekme ve dizi de kontrol eden, tepki süresine ve garda bakan, ücretsiz çalışan bir web uygulaması bulamadım. Boşluk orada. İsabet açısından sensörlü ürünlerin gerisinde kalacağı da açık.

## Gerçek videolarla test

Kamera başında denemek yerine YouTube'daki iki antrenman videosunu kare kare MediaPipe'tan geçirip hareket tanıyıcıyı onlarla ayarladım. Hocanın hangi turda ne yaptırdığını etiket olarak kullandım.

**Muay Thai videosu (5 dakika, yandan çekim).** Sonuçlar iyi sayılır:

- Cab-kros turlarında sol ve sağ düz yumruk sayıları dengeli çıktı (18'e 15, 30'a 33).
- Diz turlarında dizler doğru taraftan yakalandı.
- Sağ roundhouse turunda sağ middle kick, switch kick turunda sol middle kick öne çıktı.
- Teep (öne itme tekmesi) için ayrı bir sınıf yok; diz ya da low kick olarak okunuyor.

**Boks videosu (cab ağırlıklı, bol ayak hareketi ve dönüş).** Burada zayıf:

- Sadece cab atılan turda bile sağ el de aynı sayıda düz yumruk görünüyor, araya sahte aparkat ve kroşeler karışıyor.
- Sebebi: dövüşçü kameraya doğru dönüp uzaklaştıkça bileklerin omza göre konumu değişiyor, bu da yumruk gibi okunuyor.

Yolda öğrendiklerim:

- İlk sürümde dinlenme duruşu sadece tamamen hareketsizken güncelleniyordu. Dövüşçüler sürekli zıpladığı için bu bozuluyor ve dizlerin çoğu kaçıyordu. Bacak tespitini "bir bacak diğerinden ne kadar yukarı kalktı" diye değiştirince dizler ve tekmeler yakalanmaya başladı.
- Vücudu döndükçe sabit kalacak bir eksen takımı (kalça çizgisi + omurga) denedim. Yandan çekimde kalça derinliği gürültülü olduğu için sonuçları kötüleştirdi, geri aldım.
- 0.8 saniyeden uzun kol hareketlerini atmayı denedim. Gerçek videolarda yumruklar tanıyıcıda daha uzun görünüyor, neredeyse hepsi silindi, onu da geri aldım.

**İkinci tur: önden çekim ve hiç görmediği bir video.** Sonra iki video daha ekledim. Biri önden çekilmiş, ekranda hareket adlarının yazdığı bir kickboks antrenmanı; ayarları bununla yaptım. Diğerini hiç ayarda kullanmadım, sadece sonunda puanlamak için ayırdım. Puan şu demek: belli bir turda yakalanan hareketlerin yüzde kaçı o turda gerçekten istenen hareket.

- Önden çekilen videoda doğruluk %37'den %45'e çıktı. Kazancın çoğu kros eşiğini gevşetmekten geldi. Önden bakınca düz yumruk kol tam açılmış gibi görünmüyor, eskiden çoğu kroşe sayılıyordu.
- Bir de şunu düzelttim: tekme atarken savrulan kol bazen tekmeden "güçlü" görünüp tekmeyi siliyordu. Artık bacak hareketi varsa önce bacaklar kendi aralarında karşılaştırılıyor.
- Görmediği videoda %60'tan %65'e çıktı. Cab-kros, düz yumruk ve diz turları %80-100 arasında. Aparkat ve squat sonrası roundhouse turları zayıf (%0-30).

**Üçüncü tur: eşik taraması (26 Kasım).** Bu sefer form videolarını da etiketli bölümlere çevirip üçüncü bir kontrol seti yaptım. Bir eşiği ancak üç sette de işleri bozmuyorsa tuttum. İki değişiklik kaldı:

- Tekme ya da dizin başlaması için bir bacağın diğerinden ne kadar yukarı kalkması gerektiğini 0,5'ten 0,7'ye çıkardım. Yumruk çalışmalarındaki zıplamalar ve duruş değiştirmeler zayıf tekme gibi okunuyordu.
- Yumruk sayılması için bileğin çıkması gereken en düşük yüksekliği 0,6'dan 0,55'e indirdim. Önden çekimde biraz alçak giden gerçek yumruklar eleniyordu.

Ayar videosunda %46'dan %48'e, görmediği videoda %65'ten %68'e, form videolarında %32'den %33'e çıktı. Küçük bir kazanç ama üç sette de aynı yönde.

Kroşe ile aparkatı ayırmak için hem eşik taradım hem de kol özelliklerinden küçük bir sınıflandırıcı eğitip her seferinde bir videoyu dışarıda bırakarak denedim. İkisi de bugünkü basit kuralı geçemedi. Kroşe örneklerinin çoğu tek videodan geliyor. Önden çekilmiş, kroşe ve aparkatın ayrı etiketlendiği daha fazla video olmadan bu ayrımın düzeleceğini sanmıyorum.

**Dördüncü tur: kroşe ve aparkat için yeni videolar (26 Kasım).** İki video daha buldum. Biri önden çekilmiş, vuruşların adı ekranda yazan bir boks antrenmanı. Diğeri 1'den 6'ya kadar yumrukları tek tek, yavaşça gösteren bir anlatım videosu. İkisini de bölümlere ayırıp her bölümde hangi kolun hangi yumruğu attığını etiketledim, böylece dördüncü bir kontrol seti oldu.

İlk bakışta tablo kötüydü. Bu iki videoda tanıyıcı kroşe ile aparkatı neredeyse yazı tura ile ayırıyordu: 91 bükük kol yumruğundan 49'u doğru. Dirsek yüksekliğine baktım, kroşeler -0,41 ile -0,02 arasında, aparkatlar -0,57 ile -0,08 arasında dağılıyordu. Bu eşikle çözülecek bir şey değildi; dirsek yüksekliği eşiği (`hookElbow`) ve kolun düzlük eşiği (`straight`) için yeni değerler de yine en az bir seti bozdu.

Bileğin nasıl hareket ettiğine bakınca fark çıktı. Kroşede el daha çok yana savruluyor, aparkatta yukarı çıkıyor. Yumruktan hemen önceki 0,35 saniyeden yumruk bitene kadar bileğin dikeyde ne kadar yol aldığını yatayda aldığı yola bölüyorum. Dirsek kuralı "kroşe" dediğinde bu oran 1,25'i geçiyorsa yumruğu aparkat sayıyorum. 1,15 ile 1,4 arasındaki her değer dört setin hiçbirini kötüleştirmedi, ortasına yakın bir değer seçtim:

- Ayar videosu aynı kaldı (%48, 365/764).
- Görmediği videoda %68'den %70'e çıktı (128'den 132 doğruya). Kroşe/aparkat ayrımı orada 23'te 16'dan 20'ye çıktı.
- Form videoları aynı kaldı (%33, 120/363).
- Yeni iki videoda doğru sayısı 445'ten 468'e çıktı, kroşe/aparkat ayrımı 91'de 49'dan 72'ye.

Bedeli şu: yeni videolardaki 16 gerçek kroşenin 12'si yerine 10'u doğru çıkıyor. Kazanç neredeyse tamamen aparkat tarafında (75'te 37'den 62'ye). Kroşe örneği az, iki kayıp tesadüf de olabilir; daha çok kroşe videosuyla bakmam lazım. Eşiği de bu dört seti görerek seçtim, yani tamamen yeni bir videoda nasıl davranacağını henüz bilmiyorum. Bir de kural yalnız "kroşe"yi aparkata çeviriyor, tersini yapmıyor; yanlışlıkla aparkat denen kroşeler hâlâ öyle kalıyor.

Denediğim ama geri aldığım şeyler:

- Yumruğun gövdeye göre yönüne bakarak kroşe, aparkat ve düz yumruğu ayırmak. Önden çekimde üç hareketin değerleri neredeyse tamamen üst üste biniyor, işe yaramadı.
- Dizi low kick'ten ayırmak için "diz kalça hizasına çıkmalı" kuralı. Ayar videosunda low kick'leri düzeltti ama görmediği videoda dizleri %79'dan %11'e düşürdü. Yani o videoya ezber yapmıştı. Hareket boyunca bacağın en düz hali de iki hareketi ayırmadı.
- Çok uzun süren kol hareketlerini atmak. Gerçek hızlı yumrukları da sildi.

**Beşinci tur: belden eğilme, sağ/sol ve sahte savunma (26 Kasım akşamı).**

Belden eğilme için üç eğilme videosu daha indirdim. İkisi işe yaradı: birinde hoca önden çekimde "öne eğilme" hatasını gösteriyor, ötekinde tek kişi sadece doğru, dizden eğilmeler yapıyor. Üçüncüsü yandan ve kalabalık, ama orada da belden yapılan bir weave var. Önceki turdaki videoyla birlikte elimde üç kişiden dört belden eğilme olayı oldu (birinde aynı eğilme iki parça sayılıyor). Eğim tek başına yine ayırmadı; doğru eğilmeler de 0,76 radyana kadar öne eğiliyor. Dizlere bakınca iki ayrı durum çıktı. Bazı hocalar zaten dizleri bükük duruyor ve belden eğilirken dizini hiç oynatmıyor (diz bükümü 0,06 radyan). Bazıları da biraz büküyor ama diz açısı hiç 2,1 radyanın altına inmiyor, yani diz fazla kırılmıyor (düz bacak 3,14). Kural artık şu: gövde duruşa göre 0,5 radyandan fazla öne eğildiyse, eğilme iki durumda "belden" sayılıyor. Ya diz eğilme sırasında 0,3 radyandan az büküldüyse ya da diz açısı hiç 2,1 radyanın altına inmediyse. Eski kural (yalnız eğim 0,8'i geçerse) dört belden eğilmenin birini yakalıyordu, yeni kural dördünü de yakalıyor. Doğru eğilmelerde yanlış alarm eskisi gibi 39'da 0. Dört kontrol setinde vuruş isabeti ve sahte savunma hiç değişmedi. Yine de örnekler az ve eşikleri bu örneklere bakarak seçtim; gerçek bir kullanıcıda denenmedi. Bir doğru eğilme de sınıra yakın duruyor, orada pay dar.

Sağ/sol karışmasını saydım: dört sette 358 olayın tarafı yanlış, 345'i kol. Tek taraflı bölümlerde sağ/sol etiketi taşıyan olayların yarısına yakını ters, yani yazı tura düzeyinde. Duruşu, omuzların dönüklüğünü, bileklerin kameraya uzaklığını ve MediaPipe'ın sol/sağ noktaları karıştırıp karıştırmadığını tek tek eledim, hiçbiri açıklamadı. Sebep başka yerde çıktı: ters çıkan kol olaylarının %71'inde 0,6 saniye içinde doğru elin de bir olayı var. Yani gerçek yumruk zaten sayılıyor, gardda ya da eğilirken oynayan öbür el de ayrıca "yumruk" sayılıyor. Çakışan zayıf olayları daha sıkı elemeyi denedim; ters olaylar azaldı ama her sette doğrular da azaldı, geri aldım. Kod değişmedi. Denemediğim bir fikir var: yumruk atan elin omuzdan ne kadar öne uzandığına bakmak, öbür elin kıpırdamasını buradan ayırabilir.

Sahte savunmayı bu sefer daha doğru ölçtüm. Önceki 6,9/dk, dört yumruk videosundaki bütün savunmaları sayıyordu; hangisinin gerçek olduğunu bilmiyordu. Altyazısında kelime kelime zaman damgası olan iki yeni yumruk videosu indirdim. Bir savunmanın başladığı andan 1,5 saniye önce ile 2,5 saniye sonra arasında hoca "slip", "duck", "roll", "pull", "weave" ya da "block" demediyse onu sahte sayıyorum. İlk videoda (12,5 dakika, önden, raundların çoğu yalnız yumruk) 91 savunma çıktı, 20'si bir savunma kelimesinin yakınında, 71'i sahte: dakikada 5,7. Sahtelerin yarısı eğilme; yumruk atarken baş biraz iniyor, tanıyıcı bunu eğilme sanıyor. İkinci videoda (13,4 dakika) çok daha az hareket var, sahte savunma dakikada 1,3.

İki ayar denedim, ikisini de geri aldım:

- Eğilme sayılması için başın ne kadar inmesi gerektiğini (`duck`) 0,35'ten 0,45'e çekmek ilk videoda sahte savunmayı dakikada 5,7'den 4,6'ya, dört yumruk videosunda 6,9'dan 6,3'e indirdi, vuruş isabeti de hiç değişmedi. Eğilme dersindeki eğilme bölümleri de aynı kaldı. Ama eğilme anlatan iki videoda gerçek, sığ eğilmeleri kaybettirdi (birinde 3'ten 1'e, ötekinde 1'den 0'a). 0,4 de aynı kaybı verdi.
- Bir vuruşla çakışan savunmanın silinmemesi için kafanın daha çok oynamasını istedim (`defKeepMag` 2'den 2,5'e). Bu dört yumruk videosunda 5,5/dk verdi, ama eğilme dersinde roll bölümündeki savunmaları 20'den 10'a, ikinci kayma bölümündekileri 9'dan 5'e düşürdü.

Yani sahte savunmaları eşikle temizlemek gerçek savunmaları da götürüyor, eşikler yerinde kaldı. Uygulama savunmaya yalnız saldırı komutundan sonra bakıyor, o yüzden sahte bir eğilme ancak o pencereye denk gelirse yanlışlıkla "savundun" dedirtir.

Kısacası tekme, diz ve düz yumrukta işe yarar durumda. Önden çekimde kroşe ile aparkatı hâlâ tam ayıramıyor (bilek yönüne bakan kuraldan sonra yeni videolarda 91'de 72 doğru), bazen de diz ile low kick'i karıştırıyor; bunun için kişiye göre kalibrasyon ya da gerçek kayıtlarla eğitilmiş küçük bir sınıflandırıcı lazım. Çok dönerek, kayarak çalışırken kroşe ve aparkat ayrımına güvenme. Telefonla gerçek ortamda henüz denenmedi; ilk denemede eşiklerin biraz ayar isteyeceğini düşünüyorum.

## Doğru ve hatalı form videoları

Sonraki adımda YouTube'dan, hocaların aynı hareketi önce doğru sonra yanlış gösterdiği yedi video daha buldum: kros hataları, telegraf (vuruşu belli etmek), kroşe hataları, roundhouse ve low kick hataları, bir de kayma, roll ve eğilme dersi. Her videoda hangi saniyelerde hangi hareketin doğru ya da hangi hatayla yapıldığını etiketledim. Toplam 30 doğru, 25 hatalı bölüm çıktı. Pozlar ve etiketler `data/form/` içinde. Sayılar küçük, o yüzden aşağıdakileri "işaret" diye oku, kesin ölçüm diye değil.

**Savunma.** Kayma ve eğilme videosu eski filtreyi çürüttü. Kafa yana kayarken ya da eğilirken kollar ve bacaklar da biraz oynuyor, tanıyıcı bunları kısa yumruk ve low kick sanıyor, filtre de savunmayı siliyordu. Kayma bölümlerinde tek bir kayma bile kalmamıştı. Filtreyi yukarıda anlattığım gibi yumuşatınca aynı videoda 77 savunma çıktı, 60'ı etiketli bölümlerin içinde. İkinci kayma bölümünde 4 kayma ve 5 eğilme, roll ve eğilme bölümlerinde ise çoğunlukla eğilme çıkıyor. İlk kayma bölümünde hâlâ hiçbir şey çıkmıyor. Bedeli şu: aynı dört yumruk videosunda sahte savunma video başına 20 ile 118 arasına, yani dakikada 3 ile 12 arasına çıktı. Savaş modunda savunmaya sadece saldırı komutundan sonraki kısa pencerede bakıyorum ve o sırada normalde yumruk atılmıyor, o yüzden zararı sınırlı. Hızlı refleks modunda ise bir önceki tek vuruş komutunun hareketi pencereye taşarsa sahte bir savunma sayılabilir.

Sonra kayma eşiğini, yani kafanın kalçaların üstünden yana ne kadar kayınca kayma sayılacağını, 0,25'ten 0,3'e çektim. O sırada (yukarıdaki bacak ayarlarından sonra) kayma videosunda 81 savunma çıkıyordu, 18'i hiçbir etiketli bölüme düşmüyordu. Yeni eşikle 56 savunma çıkıyor ve bölüm dışında kalan 3. Kayma, roll ve eğilme bölümlerinde doğru türde yakalananların sayısı 36'da kaldı; kaybolanlar hep yanlış türdeydi. Dört yumruk videosunda sahte savunma dakikada ortalama 8,0'dan 6,9'a düştü. Vuruş isabetine etkisi yok.

**Belden eğilme.** Videodaki doğru, dizden eğilmelerin hepsini "belden" diye işaretliyordu. Gövdenin öne eğimi doğru eğilmelerde 0,46 ile 0,75 radyan arasında çıktı, eşik ise 0,45'ti. Eşiği 0,8'e çektim. Elimde gerçekten belden eğilen bir örnek olmadığı için yeni eşiğin hatalıyı ne kadar yakaladığını bilmiyorum.

Sonra hocanın önce yanlış (belden), sonra doğru (dizden) eğildiği bir video buldum. Belden eğilmede gövde normal duruşa göre 0,61-0,65 radyan fazladan öne eğiliyor; 0,8 eşiği bunu kaçırıyor. Eşiği indirmek de çözüm değil: aynı videodaki doğru eğilme 0,40-0,44. Eğilme dersinde bu sefer tanıyıcının yakaladığı bütün eğilmeleri tek tek ölçtüm, doğru eğilmeler 0,25 ile 0,75 arasında çıktı (yukarıdaki 0,46 alt sınırı sığ eğilmeleri saymıyordu). Yanlış örnek tam doğru eğilmelerin arasına düşüyor, o yüzden eşiği 0,8'de bıraktım. Asıl fark dizlerde görünüyor: belden eğilirken dizler neredeyse düz kalıyor (en küçük diz açısı 2,37 radyan), eğimi 0,5'i geçen doğru eğilmelerde ise diz 2,0 radyanın altına kadar bükülüyor. Yine de elimde tek bir yanlış örnek var. Bunu kurala çevirmek için en az birkaç belden eğilme örneği daha lazım. (Beşinci turda üç örnek daha buldum ve diz açısını kurala kattım, yukarıda anlatıyorum.)

**Telegraf.** En çok örneği olan hata buydu (9 bölüm). Yumruktan hemen önce elin yumruğun gideceği yönün tersine ne kadar geri gittiğini ölçen bir değer ekledim. İki videoyla ayarladım, üçüncüyü ayırdım. Ayar videolarında telegraflı yumrukların %29'u geri çekiliyor, doğru yumrukların %11'i. Ayırdığım videoda bu oran %40'a %17. Tek yumrukta güvenilir değil ama bir seans boyunca birikince işe yarıyor. Seansta en az 10 yumruk varsa ve %30'undan fazlası geri çekildiyse "yumruktan önce elini geri çekiyorsun" diyorum. Bu eşik bilerek yüksek: temiz yumruk atan birine boşuna uyarı vermesin diye. Bedeli, hafif telegraf yapanların aşağı yukarı yarısını kaçırması.

**Gard düşmesi.** Var olan kontrol kroşe videosundaki gard düşmesini yakaladı: o bölümdeki 12 yumruğun 5'inde boştaki el düşüktü, doğru kroşe bölümlerinde aşağı yukarı 10 yumrukta 1. Diğer videodaki gard düşmesini ise kaçırdı (9 yumrukta 1). Aynı kontrol tekmelerde de çalışıyor ama orada gürültülü; roundhouse'ta kolu bilerek aşağı savurmak tekniğin parçası, doğru tekmelerde bile el sık sık aşağıda görünüyor.

Dirseğin açılması, çene kalkması, pivot yapmamak gibi diğer hataların her birinden bir iki örnek var. Bunlarla bir kural kurmak ezber olurdu, o yüzden şimdilik dokunmadım.

## Bulutta eğitim neden yok

Bulutta sürekli kendini eğiten bir model kurmadım. Yukarıdaki "eğitim" aslında videolarla eşik ayarlamaktı, gerçek bir model eğitimi değil. Bunu buluta taşımanın da pratik bir engeli var: YouTube, bulut sunucularının IP adreslerinden video indirmeyi engelliyor, yani videoları orada otomatik çekip işlemek çalışmıyor. Kişiye göre ayarlanma bu yüzden telefonda, geçmiş seanslara bakarak yapılıyor (Program bölümünde anlattım).

## Sonra yapılabilecekler

- Teep ve dirsek için sınıf eklemek.
- Savunmayı daha fazla gerçek videoyla ölçmek. Şimdilik tek bir kayma/eğilme dersiyle denendi; ilk kayma bölümünü hâlâ kaçırıyor.
- Belden eğilme ve diğer form hataları için daha çok hatalı örnek bulmak.
- Kroşe/aparkat ayrımını vücut dönüşünden etkilenmeyecek hale getirmek; belki birkaç gerçek kayıtla küçük bir sınıflandırıcı eğitmek.
- Kişiye göre kalibrasyon: ilk turda birkaç hareketi yavaşça yaptırıp eşikleri ona göre ayarlamak.

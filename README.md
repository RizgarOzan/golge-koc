# Gölge Koç

Telefonun kamerasıyla seni izleyen, sesli kombinasyon söyleyen ve ne yaptığına bakıp tavsiye veren bir kickboks antrenörü. Uygulama mağazasına gerek yok: tarayıcıda açılan bir web uygulaması (PWA), istersen ana ekrana ekleyip uygulama gibi kullanırsın.

## Ne yapıyor

- Seviyeye göre (1-3) kombinasyon seçip Türkçe sesle söylüyor: "cab, kros, sağ low kick" gibi.
- Kamerada iskeletini MediaPipe ile takip ediyor, hangi elle ya da ayakla ne attığını çıkarıyor: düz yumruk, kroşe, aparkat, low/middle/high kick, diz.
- Her komut için tepki süreni ölçüyor, doğru hareketi doğru taraftan atıp atmadığına bakıyor, vururken boştaki elin düşüyor mu ve kombinasyondan sonra gardına dönüyor musun onu kontrol ediyor.
- Tur bitince kısa bir özet ve birkaç somut tavsiye veriyor ("Sağ ve solu karıştırıyorsun", "Komut beklerken elin aşağıda" gibi).
- Ortodoks ya da solak duruş seçilebiliyor; solakta taraflar kendiliğinden ters çevriliyor.
- Görüntü telefondan çıkmıyor. Bütün hesap cihazın üzerinde yapılıyor.

Dosyalar:

- `index.html`, `app.js`: arayüz, kamera, ses, tur akışı.
- `analyzer.js`: hareket tanıma ve puanlama. Tarayıcıya bağlı değil, Node ile test ediliyor.
- `test/`: sentetik iskeletlerle testler. Çalıştırmak için `node --test test/analyzer.test.mjs`.
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

Denediğim ama geri aldığım şeyler:

- Yumruğun gövdeye göre yönüne bakarak kroşe, aparkat ve düz yumruğu ayırmak. Önden çekimde üç hareketin değerleri neredeyse tamamen üst üste biniyor, işe yaramadı.
- Dizi low kick'ten ayırmak için "diz kalça hizasına çıkmalı" kuralı. Ayar videosunda low kick'leri düzeltti ama görmediği videoda dizleri %79'dan %11'e düşürdü. Yani o videoya ezber yapmıştı. Hareket boyunca bacağın en düz hali de iki hareketi ayırmadı.
- Çok uzun süren kol hareketlerini atmak. Gerçek hızlı yumrukları da sildi.

Kısacası tekme, diz ve düz yumrukta işe yarar durumda. Önden çekimde kroşe ile aparkatı, bazen de diz ile low kick'i ayıramıyor; bunun için kişiye göre kalibrasyon ya da gerçek kayıtlarla eğitilmiş küçük bir sınıflandırıcı lazım. Çok dönerek, kayarak çalışırken kroşe ve aparkat ayrımına güvenme. Telefonla gerçek ortamda henüz denenmedi; ilk denemede eşiklerin biraz ayar isteyeceğini düşünüyorum.

## Sonra yapılabilecekler

- Teep, dirsek ve savunma hareketleri (eğilme, kayma, blok) için sınıf eklemek.
- Kroşe/aparkat ayrımını vücut dönüşünden etkilenmeyecek hale getirmek; belki birkaç gerçek kayıtla küçük bir sınıflandırıcı eğitmek.
- Kişiye göre kalibrasyon: ilk turda birkaç hareketi yavaşça yaptırıp eşikleri ona göre ayarlamak.

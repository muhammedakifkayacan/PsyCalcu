import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Notebook, 
  Sparkles, 
  ShieldCheck, 
  BookOpen, 
  DollarSign, 
  ArrowRight 
} from 'lucide-react';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  icon: React.ReactNode;
  category: string;
}

export default function FAQModal({ isOpen, onClose, onStartTour }: FAQModalProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const faqs: FAQItem[] = [
    {
      category: 'general',
      icon: <HelpCircle className="w-5 h-5 text-[#cb997e]" />,
      question: "PsyCalcu Nedir ve Kimler İçindir?",
      answer: (
        <div className="space-y-3 text-slate-600 text-xs md:text-sm leading-relaxed">
          <p>
            <strong>PsyCalcu</strong>, seanslarını, danışan ödemelerini ve klinik giderlerini (ofis kirası, bakıcı ücreti vb.) tek bir yerden kolayca takip etmek isteyen psikologlar ve psikoterapistler için özel olarak tasarlanmış modern bir bütçe ve seans ajandasıdır.
          </p>
          <p className="font-semibold text-slate-800">Uygulama iki temel kullanıcı profiline de mükemmel şekilde uyum sağlar:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div className="bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1d8]/60 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#6b705c]">
                <Calendar className="w-4 h-4 shrink-0 text-[#cb997e]" />
                1. Takvim Entegrasyonu
              </div>
              <p className="text-[11px] text-slate-500">
                Seans randevularını telefonundaki takvim uygulamasından (Apple Takvim, Google Takvim vb.) takip edenler. Takvim abonelik linkinizi sisteme tek seferlik ekleyerek seanslarınızın otomatik senkronize olmasını sağlayabilirsiniz.
              </p>
            </div>
            <div className="bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1d8]/60 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#6b705c]">
                <Notebook className="w-4 h-4 shrink-0 text-[#cb997e]" />
                2. Doğrudan Ajanda Kullanımı
              </div>
              <p className="text-[11px] text-slate-500">
                Herhangi bir dış takvim kullanmadan, tüm randevularını ve ajandasını doğrudan bu sistem üzerinden manuel olarak kaydedip yönetmek ve gelir-gider dökümünü tutmak isteyenler.
              </p>
            </div>
          </div>
          <p className="text-[11px] italic text-slate-500 mt-1">
            * Dilerseniz her iki yöntemi de aynı anda (melez olarak) özgürce kullanabilirsiniz.
          </p>
        </div>
      )
    },
    {
      category: 'usage',
      icon: <BookOpen className="w-5 h-5 text-[#cb997e]" />,
      question: "Uygulama Nasıl Kullanılır? (Kullanım Kılavuzu)",
      answer: (
        <div className="space-y-4 text-slate-600 text-xs md:text-sm leading-relaxed">
          <p>Uygulamayı en verimli şekilde kullanmak için şu basit adımları izleyebilirsiniz:</p>
          <ol className="list-decimal pl-4 space-y-2 text-xs md:text-sm">
            <li>
              <strong className="text-slate-800">Seans Ekleme ve Güncelleme:</strong> Günlük ajanda sayfasında <strong className="text-[#6b705c]">"Yeni Seans Ekle"</strong> butonuyla danışan adı, seans türü (Yüz Yüze / Online), tarih, saat ve seans ücretini girerek saniyeler içinde manuel seans kaydedebilirsiniz.
            </li>
            <li>
              <strong className="text-slate-800">Akıllı Gider Ayarları:</strong> Sağ üstteki <strong className="text-slate-800">Ayarlar</strong> (çark simgesi) menüsünden seans başına düşen ofis kira payınızı ve çocuk/bebek bakımı için ödediğiniz bakıcı ücretini belirleyin. Sistem, yüz yüze seanslarınızda bu giderleri otomatik olarak brüt gelirinizden düşer.
            </li>
            <li>
              <strong className="text-slate-800">Ödeme & Borç Takibi:</strong> Seansı tamamladığınızda veya ödeme aldığınızda durumunu "Ödendi" olarak güncelleyin. Ödenmeyen seanslar <strong className="text-slate-800">Borç Takip</strong> sayfasında danışan bazında gruplanır; ödeme alındığında tek tıkla kapatabilirsiniz.
            </li>
            <li>
              <strong className="text-slate-800">Yapay Zeka Klinik Değerlendirmesi:</strong> Günlük ajandanızın altında yer alan <strong className="text-slate-800">Yapay Zeka ile Analiz Et</strong> butonuna tıklayarak o günün klinik yoğunluğunu, finansal dengesini ve yapay zeka asistanınızın önerilerini içeren detaylı değerlendirmeyi okuyabilirsiniz.
            </li>
          </ol>

          {onStartTour && (
            <div className="pt-3 border-t border-[#e5e1d8]/50 flex flex-col items-start gap-2">
              <p className="text-[11px] text-slate-500 font-medium">Uygulamanın bölümlerini ve kullanımını interaktif bir turla ekran üzerinde görmek ister misiniz?</p>
              <button
                onClick={() => {
                  onClose();
                  // delay slightly to let FAQ modal close animation complete
                  setTimeout(() => {
                    onStartTour();
                  }, 200);
                }}
                className="px-4 py-2 bg-[#cb997e] hover:bg-[#b58368] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
              >
                <Sparkles className="w-3.5 h-3.5" />
                İnteraktif Uygulama Turunu Başlat
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      category: 'sync',
      icon: <Calendar className="w-5 h-5 text-[#cb997e]" />,
      question: "Google veya Apple Takvimimi Nasıl Senkronize Ederim?",
      answer: (
        <div className="space-y-2 text-slate-600 text-xs md:text-sm leading-relaxed">
          <p>
            Telefonunuzdaki takvimi uygulamaya bağlamak oldukça kolaydır. <strong>"Takvim Entegrasyonu"</strong> sekmesine giderek detaylı resimli/videolu kılavuza ulaşabilirsiniz. Temel adımlar şöyledir:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-xs">
            <li>
              <strong>Apple Takvim için:</strong> iPhone veya Mac cihazınızda Takvim uygulamasına girin, ilgili takvimin yanındaki bilgi simgesine tıklayın, <strong>"Kamuya Açık Takvim"</strong> seçeneğini aktif edip çıkan <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">webcal://...</code> bağlantısını kopyalayın ve uygulamamızdaki ayarlara yapıştırın.
            </li>
            <li>
              <strong>Google Takvim için:</strong> Google Takvim web sitesinde sol menüden ilgili takvimin ayarlarına gidin. En altta yer alan <strong>"Gizli adreste iCal biçimindeki adres"</strong> bağlantısını kopyalayıp uygulamamızdaki ayarlara yapıştırın.
            </li>
          </ul>
          <p className="text-[11px] text-[#cb997e] font-semibold">
            🔒 Güvenlik Notu: Entegrasyon sadece randevu saatlerinizi okur; danışanlarınızın kişisel bilgilerini veya detaylı notlarını asla dışarıya aktarmaz.
          </p>
        </div>
      )
    },
    {
      category: 'security',
      icon: <ShieldCheck className="w-5 h-5 text-[#cb997e]" />,
      question: "Verilerim Güvende mi? Kaybolur mu?",
      answer: (
        <div className="space-y-2 text-slate-600 text-xs md:text-sm leading-relaxed">
          <p>
            Evet, verilerinizin güvenliği ve kalıcılığı bizim için birinci önceliktir. Uygulamamız iki katmanlı koruma ve yedekleme sunar:
          </p>
          <ul className="list-disc pl-4 space-y-1.5 text-xs">
            <li>
              <strong className="text-slate-800">Bulut Senkronizasyonu (Giriş Yapıldığında):</strong> Ücretsiz hesabınızı oluşturup giriş yaptığınızda, tüm seanslarınız, muhasebe kayıtlarınız ve takvim bağlantılarınız anlık olarak şifreli bir biçimde <strong>Google Firestore</strong> güvencesiyle bulut veritabanına yedeklenir. Cihazınızı değiştirseniz dahi kaybolmaz.
            </li>
            <li>
              <strong className="text-slate-800">Yerel Hafıza (Giriş Yapılmadan Önce):</strong> Uygulamayı giriş yapmadan kullanıyorsanız, verileriniz tarayıcınızın yerel depolama alanında (Local Storage) tutulur. Tarayıcıyı kapatıp açtığınızda verileriniz korunur; ancak tarayıcı çerezlerini/geçmişini tamamen temizlerseniz yerel verileriniz silinebilir. Bu nedenle ücretsiz üye olmanızı öneririz.
            </li>
          </ul>
          <p className="text-[11px] text-[#cb997e] font-semibold bg-[#fdfbf7] p-2.5 rounded-xl border border-[#e5e1d8]/50 flex items-start gap-2 mt-2">
            <span>💡</span>
            <span>
              <strong>Yedekleme & Manuel İndirme İpucu:</strong> Dilediğiniz her an seans kayıtlarınızı güvenceye almak veya bilgisayarınıza yerel bir yedek kaydetmek için, seans listesinin üzerinde yer alan E-Tablo entegrasyonunu kullanabilir veya verilerinizi Excel formatında indirebilirsiniz.
            </span>
          </p>
        </div>
      )
    }
  ];

  const filteredFaqs = activeCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === activeCategory);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="faq-modal-overlay">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative bg-white w-full max-w-2xl rounded-[2.5rem] border border-[#e5e1d8] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
            id="faq-modal-container"
          >
            {/* Header */}
            <div className="bg-[#fdfbf7] border-b border-[#e5e1d8] px-6 py-5 md:px-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#6b705c] rounded-xl flex items-center justify-center text-white">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif italic text-[#6b705c] font-bold">Yardım & Bilgi Merkezi</h3>
                  <p className="text-[10px] text-slate-400 font-semibold tracking-wider">SIKÇA SORULAN SORULAR VE KULLANIM KILAVUZU</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-[#e5e1d8] flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-[#f5f5f0] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs for categories */}
            <div className="px-6 pt-4 pb-2 md:px-8 border-b border-[#e5e1d8]/40 flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => { setActiveCategory('all'); setOpenIndex(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'all' ? 'bg-[#6b705c] text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent hover:border-[#e5e1d8]/50'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => { setActiveCategory('general'); setOpenIndex(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'general' ? 'bg-[#6b705c] text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent hover:border-[#e5e1d8]/50'
                }`}
              >
                Kitle & Nedir
              </button>
              <button
                onClick={() => { setActiveCategory('usage'); setOpenIndex(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'usage' ? 'bg-[#6b705c] text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent hover:border-[#e5e1d8]/50'
                }`}
              >
                Nasıl Kullanılır
              </button>
              <button
                onClick={() => { setActiveCategory('sync'); setOpenIndex(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'sync' ? 'bg-[#6b705c] text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent hover:border-[#e5e1d8]/50'
                }`}
              >
                Takvim
              </button>
              <button
                onClick={() => { setActiveCategory('security'); setOpenIndex(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'security' ? 'bg-[#6b705c] text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent hover:border-[#e5e1d8]/50'
                }`}
              >
                Güvenlik
              </button>
            </div>

            {/* Scrollable FAQ Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 md:px-8 space-y-4 [scrollbar-width:thin]">
              {filteredFaqs.map((faq, index) => {
                const isOpenItem = openIndex === index;
                return (
                  <div 
                    key={index} 
                    className={`border rounded-2xl transition-all duration-300 overflow-hidden ${
                      isOpenItem 
                        ? 'border-[#cb997e] bg-[#fdfbf7]/40 shadow-sm' 
                        : 'border-[#e5e1d8] bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Collapsible Header */}
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between text-left p-4 md:p-5 gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                          isOpenItem ? 'bg-[#cb997e]/10 text-[#cb997e]' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {faq.icon}
                        </div>
                        <span className={`text-xs md:text-sm font-semibold transition-colors ${
                          isOpenItem ? 'text-slate-800' : 'text-slate-700'
                        }`}>
                          {faq.question}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        {isOpenItem ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Accordion Content */}
                    <AnimatePresence initial={false}>
                      {isOpenItem && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                        >
                          <div className="px-4 pb-5 pt-1 pl-15 border-t border-[#e5e1d8]/40 text-slate-600">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-[#e5e1d8] px-6 py-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-500">
              <span className="text-[10px] md:text-xs font-medium text-center sm:text-left">
                PsyCalcu ile klinik süreçlerinizi ve bütçenizi yönetmek artık çok daha kolay!
              </span>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Anladım, Başlayalım
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

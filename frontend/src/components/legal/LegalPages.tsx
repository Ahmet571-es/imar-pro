import { useState } from 'react'
import { ArrowLeft, Shield, FileText, Cookie, Scale } from 'lucide-react'

type LegalTab = 'kvkk' | 'gizlilik' | 'kullanim' | 'cerez'

const TABS: { id: LegalTab; label: string; icon: React.ReactNode }[] = [
  { id: 'kvkk', label: 'KVKK Aydınlatma', icon: <Shield className="w-4 h-4" /> },
  { id: 'gizlilik', label: 'Gizlilik Politikası', icon: <FileText className="w-4 h-4" /> },
  { id: 'kullanim', label: 'Kullanım Şartları', icon: <Scale className="w-4 h-4" /> },
  { id: 'cerez', label: 'Çerez Politikası', icon: <Cookie className="w-4 h-4" /> },
]

interface Props {
  onBack: () => void
  initialTab?: LegalTab
}

export function LegalPages({ onBack, initialTab = 'kvkk' }: Props) {
  const [tab, setTab] = useState<LegalTab>(initialTab)

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-primary-dark text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-primary-dark text-sm">iP</div>
          <h1 className="font-bold">Yasal Bilgiler</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-border pb-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-primary text-white' : 'bg-white text-text-muted hover:bg-surface-alt border border-border'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-border p-6 sm:p-8 prose prose-sm max-w-none">
          {tab === 'kvkk' && <KVKKContent />}
          {tab === 'gizlilik' && <GizlilikContent />}
          {tab === 'kullanim' && <KullanimContent />}
          {tab === 'cerez' && <CerezContent />}
        </div>

        <p className="text-xs text-text-light text-center mt-8">
          Son güncelleme: {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

function KVKKContent() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-4">KVKK Aydınlatma Metni</h1>
      <p className="text-text-muted mb-4">6698 Sayılı Kişisel Verilerin Korunması Kanunu uyarınca</p>

      <h2 className="text-lg font-bold mt-6 mb-2">1. Veri Sorumlusu</h2>
      <p>imarPRO platformu olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizin korunmasına önem veriyoruz. Bu aydınlatma metni, hangi kişisel verilerin toplandığını, nasıl işlendiğini ve haklarınızı açıklamaktadır.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">2. Toplanan Kişisel Veriler</h2>
      <p>Platform üzerinden aşağıdaki kişisel veriler toplanmaktadır:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Kimlik bilgileri:</strong> Ad, soyad, e-posta adresi</li>
        <li><strong>İletişim bilgileri:</strong> E-posta adresi</li>
        <li><strong>Proje verileri:</strong> Parsel bilgileri, imar parametreleri, fizibilite hesaplama sonuçları</li>
        <li><strong>Teknik veriler:</strong> IP adresi, tarayıcı türü, erişim logları</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">3. Verilerin İşlenme Amacı</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Platform hizmetinin sunulması ve iyileştirilmesi</li>
        <li>Kullanıcı hesabı yönetimi</li>
        <li>AI plan üretimi ve fizibilite hesaplaması</li>
        <li>Teknik sorunların giderilmesi</li>
        <li>Yasal yükümlülüklerin yerine getirilmesi</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">4. Verilerin Aktarılması</h2>
      <p>Kişisel verileriniz:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>AI servisleri:</strong> Plan üretimi için Anthropic (Claude) ve xAI (Grok) API'lerine plan verileri iletilir. Bu verilerde kişisel bilgi bulunmaz.</li>
        <li><strong>Veritabanı:</strong> Supabase (PostgreSQL) üzerinde şifreli olarak saklanır.</li>
        <li><strong>Hosting:</strong> Railway (backend) ve Vercel (frontend) altyapısı kullanılır.</li>
      </ul>
      <p className="mt-2">Üçüncü taraflarla kişisel verileriniz ticari amaçla paylaşılmaz.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">5. Veri Saklama Süresi</h2>
      <p>Kişisel verileriniz, hesabınız aktif olduğu sürece saklanır. Hesap silinmesi halinde verileriniz 30 gün içinde kalıcı olarak silinir.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">6. Haklarınız (KVKK Madde 11)</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
        <li>İşlenmiş ise buna ilişkin bilgi talep etme</li>
        <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
        <li>Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme</li>
        <li>KVKK Madde 7 kapsamında silinmesini veya yok edilmesini isteme</li>
        <li>İşlenen verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
        <li>Aleyhine bir sonuç çıkması durumunda itiraz etme</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">7. İletişim</h2>
      <p>KVKK kapsamındaki taleplerinizi <strong>kvkk@imarpro.dev</strong> adresine iletebilirsiniz. Talepler en geç 30 gün içinde yanıtlanır.</p>
    </div>
  )
}

function GizlilikContent() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-4">Gizlilik Politikası</h1>

      <h2 className="text-lg font-bold mt-6 mb-2">1. Genel</h2>
      <p>imarPRO, kullanıcılarının gizliliğine saygı gösterir. Bu politika, platformun veri toplama ve kullanma uygulamalarını açıklar.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">2. Veri Güvenliği</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Tüm veri iletimi HTTPS/TLS şifreleme ile korunur</li>
        <li>Veritabanı erişimi Row Level Security (RLS) ile kısıtlanmıştır</li>
        <li>API anahtarları sunucu tarafında saklanır, kullanıcıya açık değildir</li>
        <li>Rate limiting ile kötü niyetli erişim engellenir</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">3. Üçüncü Taraf Hizmetler</h2>
      <table className="w-full border-collapse border border-border text-sm mt-2">
        <thead><tr className="bg-surface-alt"><th className="border border-border p-2 text-left">Hizmet</th><th className="border border-border p-2 text-left">Amaç</th><th className="border border-border p-2 text-left">Veri</th></tr></thead>
        <tbody>
          <tr><td className="border border-border p-2">Supabase</td><td className="border border-border p-2">Auth + veritabanı</td><td className="border border-border p-2">E-posta, proje verileri</td></tr>
          <tr><td className="border border-border p-2">Anthropic Claude</td><td className="border border-border p-2">AI plan üretimi</td><td className="border border-border p-2">Oda programı (anonim)</td></tr>
          <tr><td className="border border-border p-2">xAI Grok</td><td className="border border-border p-2">AI plan + render</td><td className="border border-border p-2">Oda programı (anonim)</td></tr>
          <tr><td className="border border-border p-2">Sentry</td><td className="border border-border p-2">Hata takibi</td><td className="border border-border p-2">Teknik hata logları</td></tr>
        </tbody>
      </table>

      <h2 className="text-lg font-bold mt-6 mb-2">4. Çerezler</h2>
      <p>Platform, oturum yönetimi için gerekli çerezleri kullanır. Detaylar için Çerez Politikası'na bakınız.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">5. Değişiklikler</h2>
      <p>Bu politika zaman zaman güncellenebilir. Önemli değişikliklerde kullanıcılar e-posta ile bilgilendirilir.</p>
    </div>
  )
}

function KullanimContent() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-4">Kullanım Şartları</h1>

      <h2 className="text-lg font-bold mt-6 mb-2">1. Hizmet Tanımı</h2>
      <p>imarPRO, gayrimenkul fizibilite analizi ve AI destekli kat planı üretimi hizmeti sunan bir SaaS platformudur.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">2. Hesap Sorumlulukları</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Hesap bilgilerinizin güvenliğinden siz sorumlusunuz</li>
        <li>Hesabınız üzerinden gerçekleştirilen tüm işlemlerden siz sorumlusunuz</li>
        <li>Yanıltıcı veya sahte bilgi girişi yasaktır</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">3. Kabul Edilen Kullanım</h2>
      <p>Platform yalnızca gayrimenkul fizibilite analizi, mimari planlama ve ilgili profesyonel amaçlarla kullanılabilir. Kötüye kullanım, spam veya yasa dışı amaçlarla kullanım yasaktır.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">4. AI Üretim Sorumluluğu</h2>
      <p className="text-danger font-semibold">Önemli:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>AI tarafından üretilen kat planları profesyonel mimari proje yerine geçmez</li>
        <li>Fizibilite hesaplamaları tahminidir, yatırım kararları için tek başına yeterli değildir</li>
        <li>Deprem analizi bilgilendirme amaçlıdır, resmi zemin etüdü raporu yerine geçmez</li>
        <li>Enerji performans tahmini BEP-TR sertifikası yerine geçmez</li>
        <li>Platform çıktılarını profesyonel mühendis/mimar kontrolünden geçirmeden uygulamayınız</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">5. Fikri Mülkiyet</h2>
      <p>Platform kaynak kodu, tasarımı ve içeriği imarPRO'ya aittir. Kullanıcıların ürettikleri proje verileri ve raporlar kullanıcının mülkiyetindedir.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">6. Hizmet Sürekliliği</h2>
      <p>Platform bakım, güncelleme veya teknik sorunlar nedeniyle geçici olarak erişime kapatılabilir. Önceden bildirim yapılmaya çalışılır ancak garanti verilmez.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">7. Sorumluluk Sınırı</h2>
      <p>imarPRO, platformun kullanımından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz. AI üretimlerinin doğruluğu garanti edilmez.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">8. Uygulanacak Hukuk</h2>
      <p>Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Ankara Mahkemeleri ve İcra Daireleri yetkilidir.</p>
    </div>
  )
}

function CerezContent() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-4">Çerez Politikası</h1>

      <h2 className="text-lg font-bold mt-6 mb-2">1. Çerez Nedir?</h2>
      <p>Çerezler, web sitesi tarafından tarayıcınıza kaydedilen küçük veri dosyalarıdır.</p>

      <h2 className="text-lg font-bold mt-6 mb-2">2. Kullanılan Çerezler</h2>
      <table className="w-full border-collapse border border-border text-sm mt-2">
        <thead><tr className="bg-surface-alt"><th className="border border-border p-2 text-left">Çerez</th><th className="border border-border p-2 text-left">Tür</th><th className="border border-border p-2 text-left">Süre</th><th className="border border-border p-2 text-left">Amaç</th></tr></thead>
        <tbody>
          <tr><td className="border border-border p-2">sb-*-auth-token</td><td className="border border-border p-2">Zorunlu</td><td className="border border-border p-2">Oturum</td><td className="border border-border p-2">Kullanıcı kimlik doğrulama</td></tr>
          <tr><td className="border border-border p-2">imar-pro-guest</td><td className="border border-border p-2">Zorunlu</td><td className="border border-border p-2">Kalıcı</td><td className="border border-border p-2">Demo mod oturum bilgisi</td></tr>
          <tr><td className="border border-border p-2">imar-pro-settings</td><td className="border border-border p-2">İşlevsel</td><td className="border border-border p-2">Kalıcı</td><td className="border border-border p-2">API key ve uygulama ayarları</td></tr>
        </tbody>
      </table>

      <h2 className="text-lg font-bold mt-6 mb-2">3. Çerez Yönetimi</h2>
      <p>Tarayıcı ayarlarından çerezleri engelleyebilir veya silebilirsiniz. Ancak zorunlu çerezlerin engellenmesi platformun düzgün çalışmasını engelleyebilir.</p>
    </div>
  )
}

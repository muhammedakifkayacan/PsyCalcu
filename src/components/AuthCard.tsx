import React, { useState } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  googleProvider,
  signInWithPopup,
  signInWithRedirect
} from '../lib/firebase';
import { User } from 'firebase/auth';
import { 
  KeyRound, 
  Mail, 
  UserPlus, 
  LogIn, 
  LogOut, 
  CloudLightning, 
  ShieldCheck, 
  ChevronRight, 
  AlertCircle,
  RefreshCw,
  Sparkles,
  Lock,
  HelpCircle
} from 'lucide-react';

interface AuthCardProps {
  user: User | null;
  onLogout: () => void;
  onAuthSuccess: (user: User, isNewUser: boolean) => void;
  existingSessionsCount: number;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  showExplanations?: boolean;
  onOpenFaq?: () => void;
}

export default function AuthCard({ user, onLogout, onAuthSuccess, existingSessionsCount, showToast, showExplanations = true, onOpenFaq }: AuthCardProps) {
  const [activeTab, setActiveTab] = useState<'google' | 'email'>('google');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrateData, setMigrateData] = useState(true);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIframe = window.self !== window.top;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('Lütfen tüm alanları doldurun.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakterden oluşmalıdır.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        localStorage.setItem('psycalcu_should_migrate', 'false');
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess(userCredential.user, false);
      } else {
        localStorage.setItem('psycalcu_should_migrate', migrateData ? 'true' : 'false');
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess(userCredential.user, migrateData);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Kimlik doğrulama sırasında bir hata oluştu.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Geçersiz e-posta adresi veya şifre.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Bu e-posta adresi zaten kullanımda.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Geçersiz bir e-posta adresi girdiniz.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Şifre çok zayıf. En az 6 karakter olmalıdır.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMsg = 'E-posta & Şifre ile kayıt/giriş seçeneği Firebase panelinizde etkinleştirilmemiş olabilir. Lütfen Firebase Console > Authentication > Sign-in Method sekmesinden "Email/Password" seçeneğini aktif edin.';
      } else if (err.message) {
        errorMsg = `Hata: ${err.message}`;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      // Prefer signInWithPopup for everyone, including mobile.
      // signInWithRedirect is notorious for failing on mobile Safari/iOS due to ITP blocking Auth cookies.
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        localStorage.setItem('psycalcu_should_migrate', migrateData ? 'true' : 'false');
        onAuthSuccess(result.user, migrateData);
      }
    } catch (err: any) {
      console.error("Google Auth Popup Error:", err);
      // Fallback to Redirect only if popup is blocked or explicitly fails on mobile
      if (isMobile && !isIframe) {
        try {
          setInfoMessage("Google ile güvenli giriş sayfasına yönlendiriliyorsunuz, lütfen bekleyin...");
          localStorage.setItem('psycalcu_pending_redirect', 'true');
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          localStorage.removeItem('psycalcu_pending_redirect');
          console.error("Google Auth Redirect Error:", redirectErr);
          setError("Yönlendirme ile giriş başlatılamadı. Lütfen başka bir giriş yöntemini deneyin.");
        }
      }
      
      if (err.code === 'auth/popup-blocked') {
        setError("Pop-up penceresi engellendi. Lütfen tarayıcı ayarlarından pop-up'lara izin verin veya uygulamayı yeni bir tarayıcı sekmesinde açın.");
      } else {
        setError(
          "Google Girişi başarısız oldu. Tarayıcınız pop-up pencerelerini engellemiş veya yerleşik (iframe) kısıtlaması uyguluyor olabilir. " +
          "Lütfen pop-up izinlerini kontrol edip tekrar deneyiniz veya uygulamayı yeni sekmede açınız."
        );
      }
    } finally {
      if (!(isMobile && !isIframe)) {
        setLoading(false);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (user) {
    return (
      <div className="bg-gradient-to-br from-[#6b705c] to-[#585c4c] text-white p-6 rounded-[2rem] shadow-lg space-y-4" id="auth-card-logged-in">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#ffe8d6]" />
            </div>
            <div>
              <span className="text-[10px] tracking-widest text-white/70 block font-semibold">AKTİF KULLANICI</span>
              <h4 className="text-sm font-bold font-mono truncate max-w-[200px]" title={user.email || ''}>
                {user.email}
              </h4>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 bg-white/10 hover:bg-white/20 transition-all rounded-xl cursor-pointer text-white flex items-center justify-center"
            title="Güvenli Çıkış Yap"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {showExplanations && (
          <div className="bg-white/10 rounded-2xl p-4 border border-white/5 space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#ffe8d6]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Bulut Senkronizasyonu Aktif
            </div>
            <p className="text-[10px] text-white/80 leading-relaxed">
              Seans verileriniz, takvim ayarlarınız ve muhasebe dökümleriniz güvenle Google Firestore veritabanına yedekleniyor. 
              Cihazınızı değiştirseniz veya tarayıcı geçmişini temizleseniz dahi kaybolmaz.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-[2.5rem] border border-[#e5e1d8] p-8 shadow-xl space-y-6 animate-fade-in" id="auth-card-login">
      {/* Brand logo & Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-[#6b705c] rounded-2xl flex items-center justify-center text-white font-serif text-3xl italic mx-auto shadow-md">
          P
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-serif italic text-[#6b705c]">PsyCalcu</h2>
          <p className="text-xs text-slate-400 font-semibold tracking-wider">GÜVENLİ BULUT GİRİŞ PORTALI</p>
        </div>
      </div>

      <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8]/50 text-center text-xs text-slate-500 space-y-1">
        <span className="font-bold text-slate-700 flex items-center justify-center gap-1">
          <Lock className="w-3.5 h-3.5 text-[#6b705c]" />
          Bulut Hesabınız Şifrelidir
        </span>
        <p className="text-[11px] leading-relaxed">
          Verileriniz tamamen size özeldir. Seanslarınızı tarayıcı önbelleği silindiğinde kaybetmemek için lütfen giriş yapın.
        </p>
      </div>

      {isMobile && isIframe && (
        <div className="bg-[#fff8e7] border border-[#f5e1b8] rounded-2xl p-4 text-left text-[11px] text-[#8a6d3b] space-y-1.5 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-xs text-[#735118]">
            <span className="text-sm">📱</span> Mobil Kullanıcı Uyarısı
          </div>
          <p>
            Bulunduğunuz yerleşik pencere (iframe/uygulama içi tarayıcı) Google Giriş ekranını engelleyebilir.
          </p>
          <p className="font-bold">
            Giriş yapılamazsa, lütfen uygulamayı Chrome/Safari tarayıcınızda yeni sekmede açarak deneyiniz.
          </p>
        </div>
      )}

      {/* Elegant Tab Switcher */}
      <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/40">
        <button
          type="button"
          onClick={() => {
            setActiveTab('google');
            setError('');
            setInfoMessage('');
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'google'
              ? 'bg-[#6b705c] text-white shadow-xs'
              : 'text-slate-500 hover:text-[#6b705c]'
          }`}
        >
          Hızlı Giriş
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('email');
            setError('');
            setInfoMessage('');
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'email'
              ? 'bg-[#6b705c] text-white shadow-xs'
              : 'text-slate-500 hover:text-[#6b705c]'
          }`}
        >
          E-posta & Şifre
        </button>
      </div>

      {activeTab === 'google' ? (
        /* Tab 1: Google Quick Login */
        <div className="space-y-3">
          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center justify-center gap-2.5 py-3 px-4 bg-[#fdfbf7] hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl border border-[#e5e1d8] hover:border-slate-300 transition-all cursor-pointer shadow-xs disabled:opacity-55 w-full"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google Hesabı ile Hızlı Giriş
          </button>
        </div>
      ) : (
        /* Tab 2: Classic Email & Password login/register */
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#a5a58d] tracking-wider block">E-POSTA ADRESİNİZ</label>
              <div className="relative">
                <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="psikolog@ornek.com"
                  className="w-full pl-10 pr-3 py-2 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#a5a58d] tracking-wider block">ŞİFRENİZ</label>
              <div className="relative">
                <KeyRound className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-10 pr-3 py-2 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#6b705c] hover:bg-[#585c4c] disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  İşlem Yapılıyor...
                </>
              ) : isLogin ? (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  Hesaba Giriş Yap
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Hesabı Oluştur ve Başlat
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setInfoMessage('');
              }}
              className="w-full text-center text-[11px] text-slate-500 hover:text-[#6b705c] font-semibold transition-colors py-1 cursor-pointer"
            >
              {isLogin 
                ? "Henüz bir hesabınız yok mu? Yeni Hesap Oluşturun" 
                : "Zaten bir hesabınız var mı? Giriş Yapın"}
            </button>
          </div>
        </form>
      )}

      {/* Existing Data Migration Switch */}
      {existingSessionsCount > 0 && (activeTab === 'google' || !isLogin) && (
        <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-100">
          <input
            type="checkbox"
            checked={migrateData}
            onChange={(e) => setMigrateData(e.target.checked)}
            className="rounded text-[#6b705c] focus:ring-[#6b705c] h-4 w-4 cursor-pointer"
          />
          <div className="text-[10px] text-slate-600 font-medium leading-normal">
            Tarayıcıdaki mevcut <span className="font-bold text-[#6b705c]">{existingSessionsCount} adet</span> seans kaydımı yeni bulut hesabıma aktar
          </div>
        </label>
      )}

      {/* Error Feedback */}
      {error && (
        <div className="p-3.5 bg-red-50 rounded-xl border border-red-100 flex gap-2 text-xs text-red-600 font-medium leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Message Feedback */}
      {infoMessage && (
        <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100 flex gap-2 text-xs text-blue-600 font-medium leading-relaxed animate-pulse">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
          <span>{infoMessage}</span>
        </div>
      )}

      {onOpenFaq && (
        <button
          type="button"
          onClick={onOpenFaq}
          className="w-full text-center text-[11px] text-[#cb997e] hover:text-[#b58368] font-bold flex items-center justify-center gap-1.5 transition-colors py-2 border-t border-dashed border-[#e5e1d8] mt-3 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          PsyCalcu Nedir? Nasıl Kullanılır? (Yardım & SSS)
        </button>
      )}
    </div>
  );
}

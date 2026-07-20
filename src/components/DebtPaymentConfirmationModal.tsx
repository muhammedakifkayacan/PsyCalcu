import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface DebtPaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  totalAmount: number;
}

export default function DebtPaymentConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  totalAmount,
}: DebtPaymentConfirmationModalProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isOpen) {
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (countdown === 0) {
      onConfirm();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative bg-white w-full max-w-md overflow-hidden rounded-[2.5rem] border border-[#e5e1d8] shadow-2xl z-50 p-6 md:p-8 flex flex-col gap-6"
            id="debt-payment-confirm-modal"
          >
            {/* Header / Warning Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-serif font-medium text-slate-800">
                  Emin misiniz?
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Text */}
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-800 font-semibold">{clientName}</strong> adlı danışanın toplam{' '}
                <strong className="text-[#cb997e] font-bold">₺{totalAmount.toLocaleString('tr-TR')}</strong> tutarındaki tüm ödenmemiş seanslarını toplu olarak <strong className="text-emerald-600">ödendi</strong> olarak işaretlemek üzeresiniz.
              </p>
              <div className="bg-[#fdfbf7] border border-amber-100 p-4 rounded-2xl text-xs text-amber-800 leading-relaxed flex gap-2.5 items-start">
                <span className="text-lg leading-none mt-0.5">⚠️</span>
                <span>
                  Bu işlem toplu olarak tüm bekleyen seansların ödeme durumunu güncelleyecektir. Lütfen yanlışlıkla tıklamadığınızdan emin olun.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs rounded-2xl cursor-pointer transition-colors text-center order-2 sm:order-1"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirm}
                disabled={countdown > 0}
                className={`flex-1 py-3 font-bold text-xs rounded-2xl transition-all text-center flex items-center justify-center gap-1.5 order-1 sm:order-2 ${
                  countdown > 0
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg cursor-pointer'
                }`}
              >
                {countdown > 0 ? (
                  <span>Evet ({countdown}s)</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Evet, Ödendi Yap</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

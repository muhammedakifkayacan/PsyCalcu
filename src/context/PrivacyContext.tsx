import React, { createContext, useContext, useState, useEffect } from 'react';

interface FormatMoneyOptions {
  showSymbol?: boolean;
  decimals?: number;
  prefix?: string;
}

interface PrivacyContextType {
  isPrivacyMode: boolean;
  setIsPrivacyMode: (val: boolean) => void;
  togglePrivacyMode: () => void;
  formatMoney: (amount: number | string | undefined | null, options?: FormatMoneyOptions) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyMode: false,
  setIsPrivacyMode: () => {},
  togglePrivacyMode: () => {},
  formatMoney: (val) => String(val || 0),
});

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('psycalcu_privacy_mode') === 'true';
    } catch (e) {
      return false;
    }
  });

  const setIsPrivacyMode = (val: boolean) => {
    setIsPrivacyModeState(val);
    try {
      localStorage.setItem('psycalcu_privacy_mode', String(val));
    } catch (e) {}
  };

  const togglePrivacyMode = () => {
    setIsPrivacyModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('psycalcu_privacy_mode', String(next));
      } catch (e) {}
      return next;
    });
  };

  const formatMoney = (
    amount: number | string | undefined | null,
    options: FormatMoneyOptions = {}
  ): string => {
    const { showSymbol = true, decimals = 0, prefix = '' } = options;
    const symbol = showSymbol ? ' ₺' : '';

    if (isPrivacyMode) {
      return `${prefix}••••${symbol}`;
    }

    const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0)) || 0;
    const formatted = num.toLocaleString('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return `${prefix}${showSymbol ? '₺' : ''}${formatted}`;
  };

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, setIsPrivacyMode, togglePrivacyMode, formatMoney }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => useContext(PrivacyContext);

interface MoneyProps extends FormatMoneyOptions {
  amount: number | string | undefined | null;
  className?: string;
  symbolPosition?: 'left' | 'right';
}

export const Money: React.FC<MoneyProps> = ({
  amount,
  showSymbol = true,
  decimals = 0,
  prefix = '',
  className = '',
  symbolPosition = 'left'
}) => {
  const { isPrivacyMode } = usePrivacy();

  if (isPrivacyMode) {
    return (
      <span
        className={`inline-flex items-center tracking-widest font-mono select-none opacity-80 ${className}`}
        title="Gizlilik Modu Açık (Paraları Göster butonuna basarak görünür yapabilirsiniz)"
      >
        {prefix}•••• {showSymbol ? '₺' : ''}
      </span>
    );
  }

  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0)) || 0;
  const formatted = num.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (!showSymbol) {
    return <span className={className}>{prefix}{formatted}</span>;
  }

  return (
    <span className={className}>
      {prefix}
      {symbolPosition === 'left' ? `₺${formatted}` : `${formatted} ₺`}
    </span>
  );
};

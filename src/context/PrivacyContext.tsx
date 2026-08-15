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
  isHideClientNames: boolean;
  setIsHideClientNames: (val: boolean) => void;
  toggleHideClientNames: () => void;
  formatMoney: (amount: number | string | undefined | null, options?: FormatMoneyOptions) => string;
  formatClientName: (name: string | undefined | null) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyMode: false,
  setIsPrivacyMode: () => {},
  togglePrivacyMode: () => {},
  isHideClientNames: false,
  setIsHideClientNames: () => {},
  toggleHideClientNames: () => {},
  formatMoney: (val) => String(val || 0),
  formatClientName: (name) => String(name || ''),
});

/**
 * Danışan isimlerini maskeleme fonksiyonu (örn: "Ebru Yılmaz" -> "E*** Y***")
 */
export const maskTurkishName = (name: string | undefined | null): string => {
  if (!name || !name.trim()) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 1) return word;
      return word.charAt(0) + '***';
    })
    .join(' ');
};

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('psycalcu_privacy_mode') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [isHideClientNames, setIsHideClientNamesState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('psycalcu_hide_client_names') === 'true';
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

  const setIsHideClientNames = (val: boolean) => {
    setIsHideClientNamesState(val);
    try {
      localStorage.setItem('psycalcu_hide_client_names', String(val));
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

  const toggleHideClientNames = () => {
    setIsHideClientNamesState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('psycalcu_hide_client_names', String(next));
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

  const formatClientName = (name: string | undefined | null): string => {
    if (!name) return '';
    if (isHideClientNames) {
      return maskTurkishName(name);
    }
    return name;
  };

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode,
        setIsPrivacyMode,
        togglePrivacyMode,
        isHideClientNames,
        setIsHideClientNames,
        toggleHideClientNames,
        formatMoney,
        formatClientName,
      }}
    >
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

export const MaskedClientName: React.FC<{ name: string | undefined | null; className?: string }> = ({
  name,
  className = '',
}) => {
  const { formatClientName } = usePrivacy();
  return <span className={className}>{formatClientName(name)}</span>;
};


/**
 * Formatters Utility
 * Helper functions for formatting currency, dates, and numbers
 */

// ============================================
// CURRENCY FORMATTERS
// ============================================

/**
 * Format number to Indonesian Rupiah
 * @param amount - Number to format
 * @param showPrefix - Show 'Rp' prefix (default: true)
 */
export const formatIDR = (amount: number, showPrefix: boolean = true): string => {
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  
    return showPrefix ? `Rp ${formatted}` : formatted;
  };
  
  /**
   * Format number to Saudi Riyal (angka Latin, bukan Arab)
   * @param amount - Number to format
   * @param showPrefix - Show 'SAR' suffix (default: true)
   */
  export const formatSAR = (amount: number, showPrefix: boolean = true): string => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  
    return showPrefix ? `${formatted} SAR` : formatted;
  };
  
  /**
   * Format number to US Dollar
   * @param amount - Number to format
   * @param showPrefix - Show '$' prefix (default: true)
   */
  export const formatUSD = (amount: number, showPrefix: boolean = true): string => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  
    return showPrefix ? `$${formatted}` : formatted;
  };
  
  /**
   * Format currency based on currency code
   * @param amount - Number to format
   * @param currency - Currency code ('IDR', 'SAR', 'USD')
   */
  export const formatCurrency = (amount: number, currency: 'IDR' | 'SAR' | 'USD'): string => {
    switch (currency) {
      case 'IDR':
        return formatIDR(amount);
      case 'SAR':
        return formatSAR(amount);
      case 'USD':
        return formatUSD(amount);
      default:
        return amount.toString();
    }
  };

/** Label kolom tabel harga seragam di semua modul */
export const PRICE_COLUMN_LABEL = 'Harga (IDR · SAR · USD)';

/**
 * Nilai untuk tampilan sel tabel harga (satu kolom IDR · SAR · USD).
 * Gunakan: baris pertama idrText, baris kedua "SAR: sarText  USD: usdText" (text-xs text-slate-500).
 */
export function getPriceTripleForTable(
  idr: number | null | undefined,
  sar: number | null | undefined,
  usd: number | null | undefined,
  options?: { formatIDR?: (n: number) => string; formatSAR?: (n: number, showPrefix?: boolean) => string; formatUSD?: (n: number, showPrefix?: boolean) => string }
): { hasPrice: boolean; idrText: string; sarText: string; usdText: string } {
  const fmtIdr = options?.formatIDR ?? ((n: number) => formatIDR(n));
  const fmtSar = options?.formatSAR ?? ((n: number, show = false) => formatSAR(n, show));
  const fmtUsd = options?.formatUSD ?? ((n: number, show = false) => formatUSD(n, show));
  const hasIdr = idr != null && Number(idr) > 0;
  const hasSar = sar != null && Number(sar) > 0;
  const hasUsd = usd != null && Number(usd) > 0;
  const hasPrice = hasIdr || hasSar || hasUsd;
  return {
    hasPrice,
    idrText: hasIdr ? fmtIdr(Number(idr)) : '–',
    sarText: hasSar ? fmtSar(Number(sar), false) : '–',
    usdText: hasUsd ? fmtUsd(Number(usd), false) : '–'
  };
}

/**
 * Format angka untuk ditampilkan di tabel/label (dengan pemisah ribuan).
 * Jangan dipakai di input—pakai getPriceInputDisplayValue agar user bisa mengedit.
 */
export function formatPriceForInput(value: number, currency: 'IDR' | 'SAR' | 'USD'): string {
  if (value === 0 || Number.isNaN(value)) return '';
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/**
 * Nilai tampilan untuk input harga: tanpa pemisah ribuan agar bisa diedit (cursor tidak loncat).
 * IDR: angka bulat. SAR/USD: 2 desimal.
 */
export function getPriceInputDisplayValue(value: number, currency: 'IDR' | 'SAR' | 'USD'): string {
  if (value === 0 || Number.isNaN(value)) return '';
  if (currency === 'IDR') return String(Math.round(value));
  return value.toFixed(2);
}

/**
 * Parse string input harga ke number (hapus pemisah ribuan/desimal sesuai currency).
 */
export function parsePriceInput(str: string, currency: 'IDR' | 'SAR' | 'USD'): number {
  const s = (str || '').trim();
  if (!s) return 0;
  if (currency === 'IDR') {
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    return Math.max(0, parseFloat(cleaned) || 0);
  }
  const cleaned = s.replace(/,/g, '');
  return Math.max(0, parseFloat(cleaned) || 0);
}

/** Hitung jumlah "karakter bermakna" (digit + satu desimal untuk SAR/USD) sebelum posisi kursor */
function countSignificantBeforeCursor(inputStr: string, cursorPos: number, currency: 'IDR' | 'SAR' | 'USD'): number {
  const sub = inputStr.substring(0, cursorPos);
  let count = 0;
  let seenDecimal = false;
  for (const c of sub) {
    if (/\d/.test(c)) count++;
    else if (currency !== 'IDR' && (c === '.' || c === ',') && !seenDecimal) {
      seenDecimal = true;
      count++;
    }
  }
  return count;
}

/** Posisi kursor di string terformat agar sesuai dengan jumlah karakter bermakna */
function positionAfterSignificantChars(formatted: string, currency: 'IDR' | 'SAR' | 'USD', targetCount: number): number {
  let count = 0;
  let seenDecimal = false;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) count++;
    else if (currency !== 'IDR' && formatted[i] === '.' && !seenDecimal) {
      seenDecimal = true;
      count++;
    }
    if (count >= targetCount) return i + 1;
  }
  return formatted.length;
}

/**
 * Format input harga sesuai mata uang dan hitung posisi kursor baru (agar bisa diedit tanpa loncat).
 * Dipakai di komponen input harga: parse -> format -> set state -> set cursor.
 */
export function formatPriceInputWithCursor(
  inputValue: string,
  selectionStart: number,
  currency: 'IDR' | 'SAR' | 'USD'
): { formatted: string; cursorPosition: number } {
  const num = parsePriceInput(inputValue, currency);
  const formatted = num === 0 || Number.isNaN(num) ? '' : formatPriceForInput(num, currency);
  const significantBefore = countSignificantBeforeCursor(inputValue, selectionStart, currency);
  const cursorPosition = positionAfterSignificantChars(formatted, currency, significantBefore);
  return { formatted, cursorPosition };
}
  
  /**
   * Format large numbers with K, M, B suffix
   * @param num - Number to format
   */
  export const formatCompactNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1) + 'B';
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
  };
  
  // ============================================
  // DATE & TIME FORMATTERS
  // ============================================
  
  /**
   * Format date to Indonesian format (DD/MM/YYYY)
   * @param date - Date string or Date object
   */
  export const formatDateID = (date: string | Date): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  };
  
  /**
   * Format date to long format (e.g., "14 Februari 2026")
   * @param date - Date string or Date object
   */
  export const formatDateLong = (date: string | Date): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  };
  
  /**
   * Format date with time (DD/MM/YYYY HH:MM)
   * @param date - Date string or Date object
   */
  export const formatDateTime = (date: string | Date): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };
  
  /**
   * Format time only (HH:MM)
   * @param date - Date string or Date object
   */
  export const formatTime = (date: string | Date): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };
  
  /**
   * Get relative time (e.g., "2 hours ago", "3 days ago")
   * @param date - Date string or Date object
   */
  export const formatRelativeTime = (date: string | Date): string => {
    const d = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
    if (diffInSeconds < 60) {
      return 'Just now';
    }
  
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
  
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
  
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
  
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    }
  
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  };
  
  // ============================================
  // NUMBER FORMATTERS
  // ============================================
  
  /**
   * Format percentage
   * @param value - Number to format (0.15 = 15%)
   * @param decimals - Number of decimal places
   */
  export const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };
  
  /**
   * Format phone number to Indonesian format
   * @param phone - Phone number string
   */
  export const formatPhoneNumber = (phone: string): string => {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format: +62 812-3456-7890
    if (cleaned.startsWith('62')) {
      const withoutCountryCode = cleaned.substring(2);
      return `+62 ${withoutCountryCode.substring(0, 3)}-${withoutCountryCode.substring(3, 7)}-${withoutCountryCode.substring(7)}`;
    }
    
    // Format: 0812-3456-7890
    if (cleaned.startsWith('0')) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
    }
    
    return phone;
  };
  
  /**
   * Truncate text with ellipsis
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   */
  export const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };
  
  /**
   * Capitalize first letter of each word
   * @param text - Text to capitalize
   */
  export const capitalizeWords = (text: string): string => {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  /**
   * Format file size (bytes to KB, MB, GB)
   * @param bytes - File size in bytes
   */
  export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
  
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
  
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

/**
 * Format nomor invoice untuk tampilan: StatusInvoice_INV-2026-67611
 * @param status - Status invoice (draft, tentative, paid, dll)
 * @param invoiceNumber - Nomor invoice (INV-2026-67611)
 * @param statusLabels - Peta status -> label (opsional)
 */
export const formatInvoiceDisplay = (
  status: string,
  invoiceNumber: string,
  statusLabels?: Record<string, string>
): string => {
  const label = statusLabels?.[status] || status;
  if (!label) return invoiceNumber || '–';
  return `${label}_${invoiceNumber}`;
};

/** Invoice object minimal untuk format display (sama seperti menu Invoice). */
type InvoiceDisplayInv = {
  status?: string;
  invoice_number?: string;
  is_draft_order?: boolean;
  Order?: { order_number?: string } | null;
} | null | undefined;

/**
 * Format nomor invoice seragam di semua halaman (sama dengan menu Invoice).
 * Draft: "Draft (order_number)". Non-draft: "StatusLabel_InvoiceNumber".
 */
export const formatInvoiceNumberDisplay = (
  inv: InvoiceDisplayInv,
  statusLabels?: Record<string, string>
): string => {
  if (!inv) return '–';
  const isDraft = inv.status === 'draft' || inv.is_draft_order;
  if (isDraft) return `Draft${inv.Order?.order_number ? ` (${inv.Order.order_number})` : ''}`;
  return formatInvoiceDisplay(inv.status || '', inv.invoice_number || '', statusLabels);
};
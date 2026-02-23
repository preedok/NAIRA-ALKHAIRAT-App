/**
 * Validators Utility
 * Helper functions for form validation
 */

// ============================================
// EMAIL VALIDATION
// ============================================

export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  export const validateEmail = (email: string): string | null => {
    if (!email) return 'Email is required';
    if (!isValidEmail(email)) return 'Please enter a valid email address';
    return null;
  };
  
  // ============================================
  // PASSWORD VALIDATION
  // ============================================
  
  export const isValidPassword = (password: string, minLength: number = 8): boolean => {
    if (password.length < minLength) return false;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasUpperCase && hasLowerCase && hasNumber;
  };
  
  export const validatePassword = (password: string, minLength: number = 8): string | null => {
    if (!password) return 'Password is required';
    if (password.length < minLength) return `Password must be at least ${minLength} characters`;
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/\d/.test(password)) return 'Password must contain at least one number';
    return null;
  };
  
  // ============================================
  // PHONE NUMBER VALIDATION
  // ============================================
  
  export const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) return cleaned.length >= 11 && cleaned.length <= 14;
    if (cleaned.startsWith('0')) return cleaned.length >= 10 && cleaned.length <= 13;
    return false;
  };
  
  export const validatePhoneNumber = (phone: string): string | null => {
    if (!phone) return 'Phone number is required';
    if (!isValidPhoneNumber(phone)) return 'Please enter a valid Indonesian phone number';
    return null;
  };
  
  // ============================================
  // STRING VALIDATION
  // ============================================
  
  export const isEmpty = (value: string): boolean => {
    return !value || value.trim().length === 0;
  };
  
  export const isValidLength = (value: string, minLength: number = 0, maxLength: number = Infinity): boolean => {
    const length = value.trim().length;
    return length >= minLength && length <= maxLength;
  };
  
  // ============================================
  // NUMERIC VALIDATION
  // ============================================
  
  export const isNumeric = (value: any): boolean => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  };
  
  export const isPositive = (value: number): boolean => {
    return value > 0;
  };
  
  export const isInRange = (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
  };
  
  // ============================================
  // FORM VALIDATION HELPER
  // ============================================
  
  export const validateRequired = (value: any, fieldName: string = 'This field'): string | null => {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`;
    }
    if (typeof value === 'string' && isEmpty(value)) {
      return `${fieldName} is required`;
    }
    return null;
  };
  
  export const validateMin = (value: number, min: number, fieldName: string = 'Value'): string | null => {
    if (value < min) return `${fieldName} must be at least ${min}`;
    return null;
  };
  
  export const validateMax = (value: number, max: number, fieldName: string = 'Value'): string | null => {
    if (value > max) return `${fieldName} must not exceed ${max}`;
    return null;
  };
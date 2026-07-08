import bcrypt from 'bcryptjs';

/**
 * Checks if a PIN is already hashed with bcrypt.
 */
export const isHashedPin = (pin: string): boolean => {
  return typeof pin === 'string' && pin.length === 60 && pin.startsWith('$2');
};

/**
 * Hashes a plaintext PIN using bcrypt with 10 rounds.
 * If the PIN is already hashed, returns it as-is.
 */
export const hashPin = (pin: string): string => {
  if (!pin) return '';
  if (isHashedPin(pin)) return pin;
  return bcrypt.hashSync(pin, 10);
};

/**
 * Verifies a plaintext PIN against a stored hash (or plaintext for legacy fallback).
 */
export const verifyPin = (pin: string, storedValue: string): boolean => {
  if (!pin || !storedValue) return false;
  if (isHashedPin(storedValue)) {
    try {
      return bcrypt.compareSync(pin, storedValue);
    } catch (err) {
      console.error('[Security] PIN verification error:', err);
      return false;
    }
  }
  // Fallback for legacy plaintext PINs
  return pin === storedValue;
};

/**
 * Checks if the given PIN (which could be plaintext or bcrypt-hashed) matches the default PIN "123456".
 */
export const isDefaultPinValue = (pin: string): boolean => {
  if (!pin) return false;
  if (pin === '123456') return true;
  if (isHashedPin(pin)) {
    try {
      return bcrypt.compareSync('123456', pin);
    } catch (e) {
      return false;
    }
  }
  return false;
};

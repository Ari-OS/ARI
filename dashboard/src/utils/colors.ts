/**
 * Static Tailwind Color Classes
 *
 * Tailwind CSS uses JIT compilation that scans for class names at build time.
 * Dynamic class construction (e.g., `bg-${color}-600`) fails because the scanner
 * can't detect these patterns. This module provides static class mappings.
 *
 * Usage:
 *   import { bgClasses, textClasses, borderClasses } from '../utils/colors';
 *   <div className={bgClasses.emerald}> // 'bg-emerald-900/20'
 */

export type ColorName = 'emerald' | 'amber' | 'red' | 'purple' | 'blue' | 'cyan' | 'gray';

/**
 * Background color classes (900 shade with 20% opacity for dark theme)
 */
export const bgClasses: Record<ColorName, string> = {
  emerald: 'bg-emerald-900/20',
  amber: 'bg-amber-900/20',
  red: 'bg-red-900/20',
  purple: 'bg-purple-900/20',
  blue: 'bg-blue-900/20',
  cyan: 'bg-cyan-900/20',
  gray: 'bg-gray-900/20',
};

/**
 * Lighter background classes (900 shade with 30% opacity)
 */
export const bgLightClasses: Record<ColorName, string> = {
  emerald: 'bg-emerald-900/30',
  amber: 'bg-amber-900/30',
  red: 'bg-red-900/30',
  purple: 'bg-purple-900/30',
  blue: 'bg-blue-900/30',
  cyan: 'bg-cyan-900/30',
  gray: 'bg-gray-900/30',
};

/**
 * Background 600 shade classes (for solid backgrounds)
 */
export const bg600Classes: Record<ColorName, string> = {
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-600',
  red: 'bg-red-600',
  purple: 'bg-purple-600',
  blue: 'bg-blue-600',
  cyan: 'bg-cyan-600',
  gray: 'bg-gray-600',
};

/**
 * Background 900/10 shade classes (very subtle backgrounds)
 */
export const bgSubtleClasses: Record<ColorName, string> = {
  emerald: 'bg-emerald-900/10',
  amber: 'bg-amber-900/10',
  red: 'bg-red-900/10',
  purple: 'bg-purple-900/10',
  blue: 'bg-blue-900/10',
  cyan: 'bg-cyan-900/10',
  gray: 'bg-gray-900/10',
};

/**
 * Text color classes (400 shade for dark theme readability)
 */
export const textClasses: Record<ColorName, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  purple: 'text-purple-400',
  blue: 'text-blue-400',
  cyan: 'text-cyan-400',
  gray: 'text-gray-400',
};

/**
 * Border color classes (800 shade for dark theme)
 */
export const borderClasses: Record<ColorName, string> = {
  emerald: 'border-emerald-800',
  amber: 'border-amber-800',
  red: 'border-red-800',
  purple: 'border-purple-800',
  blue: 'border-blue-800',
  cyan: 'border-cyan-800',
  gray: 'border-gray-800',
};

/**
 * Get all classes for a color at once
 */
export function getColorClasses(color: ColorName): {
  bg: string;
  bgLight: string;
  bg600: string;
  bgSubtle: string;
  text: string;
  border: string;
} {
  return {
    bg: bgClasses[color],
    bgLight: bgLightClasses[color],
    bg600: bg600Classes[color],
    bgSubtle: bgSubtleClasses[color],
    text: textClasses[color],
    border: borderClasses[color],
  };
}

/**
 * Combined classes for card-like components
 */
export const cardClasses: Record<ColorName, string> = {
  emerald: 'border-emerald-800 bg-emerald-900/20',
  amber: 'border-amber-800 bg-amber-900/20',
  red: 'border-red-800 bg-red-900/20',
  purple: 'border-purple-800 bg-purple-900/20',
  blue: 'border-blue-800 bg-blue-900/20',
  cyan: 'border-cyan-800 bg-cyan-900/20',
  gray: 'border-gray-800 bg-gray-900/20',
};

/**
 * Combined classes for badge-like components
 */
export const badgeClasses: Record<ColorName, string> = {
  emerald: 'bg-emerald-900/30 text-emerald-400',
  amber: 'bg-amber-900/30 text-amber-400',
  red: 'bg-red-900/30 text-red-400',
  purple: 'bg-purple-900/30 text-purple-400',
  blue: 'bg-blue-900/30 text-blue-400',
  cyan: 'bg-cyan-900/30 text-cyan-400',
  gray: 'bg-gray-700 text-gray-400',
};

/**
 * Icon container classes (rounded-lg with colored background)
 */
export const iconContainerClasses: Record<ColorName, string> = {
  emerald: 'bg-emerald-900/30 text-emerald-400',
  amber: 'bg-amber-900/30 text-amber-400',
  red: 'bg-red-900/30 text-red-400',
  purple: 'bg-purple-900/30 text-purple-400',
  blue: 'bg-blue-900/30 text-blue-400',
  cyan: 'bg-cyan-900/30 text-cyan-400',
  gray: 'bg-gray-900/30 text-gray-400',
};

/**
 * Circular icon classes for flow diagrams
 */
export const circleIconClasses: Record<ColorName, string> = {
  emerald: 'bg-emerald-900/30 text-emerald-400',
  amber: 'bg-amber-900/30 text-amber-400',
  red: 'bg-red-900/30 text-red-400',
  purple: 'bg-purple-900/30 text-purple-400',
  blue: 'bg-blue-900/30 text-blue-400',
  cyan: 'bg-cyan-900/30 text-cyan-400',
  gray: 'bg-gray-900/30 text-gray-400',
};

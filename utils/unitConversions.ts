/**
 * Unit Conversion Utilities
 *
 * Converts imperial units to metric for display in the admin interface.
 * All pipe specifications are stored and displayed in metric units.
 */

/**
 * Convert inches to millimeters
 * @param inches - Measurement in inches
 * @returns Measurement in millimeters
 */
export const inchesToMillimeters = (inches: number): number => {
  return inches * 25.4;
};

/**
 * Convert pounds per foot to kilograms per meter
 * @param lbsPerFt - Weight in lbs/ft
 * @returns Weight in kg/m
 */
export const lbsPerFtToKgPerM = (lbsPerFt: number): number => {
  return lbsPerFt * 1.488164;
};

/**
 * Convert feet to meters
 * @param feet - Length in feet
 * @returns Length in meters
 */
export const feetToMeters = (feet: number): number => {
  return feet * 0.3048;
};

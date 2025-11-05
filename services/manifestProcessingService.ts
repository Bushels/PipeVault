/**
 * Manifest Processing Service
 * Uses Google Gemini Vision API to extract pipe data from manifest documents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ManifestItem {
  manufacturer: string | null;
  heat_number: string | null;
  serial_number: string | null;
  tally_length_ft: number | null;
  quantity: number;
  grade: string | null;
  outer_diameter: number | null;
  weight_lbs_ft: number | null;
}

export interface ValidationError {
  field: string;
  joint_index: number;
  issue: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  is_valid: boolean;
  total_joints: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: {
    manufacturer_corrections?: Record<string, string>;
  };
}

export interface LoadSummary {
  total_joints: number;
  total_length_ft: number;
  total_length_m: number;
  total_weight_lbs: number;
  total_weight_kg: number;
}

const MANIFEST_EXTRACTION_PROMPT = `
You are a pipe manifest data extraction specialist for the oil & gas industry.

Extract ALL pipe joints from this manifest document into structured JSON.

For each joint/row, extract:
- manufacturer: Company that made the pipe (e.g., "Tenaris", "VAM", "US Steel", "TMK IPSCO")
- heat_number: Heat/lot number (usually alphanumeric like "H12345", "AB-67890", "123456")
- serial_number: Unique joint identifier (may be stamped, stenciled, or printed)
- tally_length_ft: Actual measured length in FEET (convert from meters if needed: 1m = 3.28084ft)
- quantity: Number of joints (usually 1 per line, but could be multiple identical joints)
- grade: Steel grade (e.g., "L80", "P110", "J55", "N80", "K55", "C95", "T95")
- outer_diameter: Outside diameter in INCHES (e.g., 2.875, 3.5, 4.5, 5.5, 7.0, 9.625, 13.375)
- weight_lbs_ft: Weight per foot in POUNDS (e.g., 6.5, 9.5, 13.3, 17.0, 23.0, 26.4, 29.7)

**CRITICAL RULES:**
1. If a field is missing or unclear, use null (not empty string, not "N/A")
2. Heat numbers are typically 5-10 characters, alphanumeric
3. Serial numbers may include manufacturer prefix (e.g., "TNS-12345", "VAM-67890")
4. Tally lengths for drill pipe: typically 28-33 feet (Range 2)
5. Tally lengths for casing/tubing: typically 38-45 feet (Range 3)
6. Convert ALL measurements to imperial units (feet, inches, lbs/ft)
7. Preserve leading zeros in serial numbers
8. Grade letters are usually capitalized (L80, not l80)
9. If the document shows a summary row (totals), DO NOT include it as a joint

**COMMON ABBREVIATIONS:**
- DP = Drill Pipe
- HWDP = Heavy Weight Drill Pipe
- DC = Drill Collar
- Csg = Casing
- Tbg = Tubing
- BTC = Buttress Thread Casing
- LTC = Long Thread Casing
- STC = Short Thread Casing
- EUE = External Upset End
- IEU = Internal External Upset
- IF = Internal Flush
- FH = Full Hole

Return ONLY valid JSON array (no markdown, no code blocks, no explanation):
[
  {
    "manufacturer": "Tenaris",
    "heat_number": "H12345",
    "serial_number": "TNS-001",
    "tally_length_ft": 31.2,
    "quantity": 1,
    "grade": "L80",
    "outer_diameter": 5.5,
    "weight_lbs_ft": 23.0
  }
]

If you cannot extract any data, return an empty array: []
`;

const VALIDATION_PROMPT = `
You are a pipe manifest quality control specialist.

Review this extracted pipe manifest data for errors and inconsistencies.

**Data to review:**
{DATA}

**Check for:**

1. **Duplicate serial numbers** - Flag any serial numbers that appear more than once
2. **Invalid heat number formats** - Should be alphanumeric, typically 5-10 characters
3. **Impossible tally lengths:**
   - Drill pipe (DP): typically 28-33 ft (flag if <25 or >35)
   - Casing/Tubing: typically 38-45 ft (flag if <35 or >48)
   - ANY pipe: flag if <20 ft or >50 ft
4. **Missing critical fields** - manufacturer, heat_number, or serial_number missing
5. **Inconsistent manufacturers** - Flag unusual spellings or variations:
   - "Tenaris" vs "TENARIS" vs "TENRIS"
   - "VAM" vs "V.A.M." vs "Vallourec"
   - "US Steel" vs "USS" vs "U.S. Steel"
6. **Grade format issues** - Should be uppercase letters + numbers (e.g., L80, P110)
7. **Impossible diameter/weight combinations** - Cross-check OD with typical weights
8. **Quantity anomalies** - Flag if quantity > 1 (unusual for individual joint tracking)

**Common manufacturer name standardization:**
- TENRIS, TENARIS → Tenaris
- VAM, V.A.M., Vallourec → VAM
- USS, U.S. STEEL → US Steel
- TMK, IPSCO → TMK IPSCO
- HUNTING → Hunting Energy Services

Return ONLY valid JSON (no markdown, no code blocks):
{
  "is_valid": boolean (false if ANY errors exist),
  "total_joints": number (count of items),
  "errors": [
    {
      "field": "serial_number",
      "joint_index": 5,
      "issue": "Duplicate serial number: ABC-005 (also appears at index 12)",
      "severity": "error"
    }
  ],
  "warnings": [
    {
      "field": "tally_length_ft",
      "joint_index": 3,
      "issue": "Unusually short for casing: 22.1 ft (typical range 38-45 ft)",
      "severity": "warning"
    }
  ],
  "suggestions": {
    "manufacturer_corrections": {
      "TENRIS": "Tenaris",
      "USS": "US Steel"
    }
  }
}
`;

/**
 * Convert blob to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Extract manifest data from document using Gemini Vision
 * @param file - PDF or image file
 * @returns Array of extracted pipe joints
 */
export const extractManifestData = async (
  file: File
): Promise<ManifestItem[]> => {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GOOGLE_AI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.1, // Low temperature for factual extraction
      topK: 1,
      topP: 0.95,
    }
  });

  // Convert file to base64
  const base64 = await blobToBase64(file);
  const base64Data = base64.split(',')[1];

  // Determine mime type
  let mimeType = file.type;
  if (!mimeType) {
    // Fallback based on file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') mimeType = 'application/pdf';
    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else mimeType = 'application/octet-stream';
  }

  console.log(`📄 Processing manifest: ${file.name} (${mimeType}, ${(file.size / 1024).toFixed(1)} KB)`);

  try {
    // Send to Gemini Vision
    const result = await model.generateContent([
      MANIFEST_EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType,
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    console.log('🤖 Gemini Vision response received');

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('⚠️ No JSON array found in Gemini response:', text.substring(0, 200));
      throw new Error('No valid JSON array found in AI response. The document may be unreadable or contain no pipe data.');
    }

    const extracted = JSON.parse(jsonMatch[0]) as ManifestItem[];
    console.log(`✅ Extracted ${extracted.length} joints from manifest`);

    return extracted;
  } catch (error: any) {
    console.error('❌ Manifest extraction failed:', error);
    throw new Error(`Failed to extract manifest data: ${error.message}`);
  }
};

/**
 * Validate extracted manifest data for errors
 * @param data - Extracted manifest items
 * @returns Validation result with errors and warnings
 */
export const validateManifestData = async (
  data: ManifestItem[]
): Promise<ValidationResult> => {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GOOGLE_AI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.95,
    }
  });

  const promptWithData = VALIDATION_PROMPT.replace('{DATA}', JSON.stringify(data, null, 2));

  console.log(`🔍 Validating ${data.length} manifest items...`);

  try {
    const result = await model.generateContent(promptWithData);
    const response = await result.response;
    const text = response.text();

    // Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ No JSON object found in validation response');
      // Return default validation result
      return {
        is_valid: true,
        total_joints: data.length,
        errors: [],
        warnings: [],
        suggestions: {}
      };
    }

    const validation = JSON.parse(jsonMatch[0]) as ValidationResult;

    console.log(`✅ Validation complete: ${validation.errors.length} errors, ${validation.warnings.length} warnings`);

    return validation;
  } catch (error: any) {
    console.error('❌ Validation failed:', error);
    // Return default validation on error (don't block the user)
    return {
      is_valid: true,
      total_joints: data.length,
      errors: [],
      warnings: [{
        field: 'validation',
        joint_index: -1,
        issue: `Validation service temporarily unavailable: ${error.message}`,
        severity: 'warning'
      }],
      suggestions: {}
    };
  }
};

/**
 * Process manifest file end-to-end: extract + validate
 * @param file - PDF or image file
 * @returns Extracted data and validation results
 */
export const processManifest = async (file: File): Promise<{
  items: ManifestItem[];
  validation: ValidationResult;
}> => {
  console.log('🚀 Starting manifest processing pipeline...');

  // Step 1: Extract data
  const items = await extractManifestData(file);

  if (items.length === 0) {
    return {
      items: [],
      validation: {
        is_valid: false,
        total_joints: 0,
        errors: [{
          field: 'document',
          joint_index: -1,
          issue: 'No pipe data found in document. Please verify the document is a valid manifest.',
          severity: 'error'
        }],
        warnings: [],
        suggestions: {}
      }
    };
  }

  // Step 2: Validate data
  const validation = await validateManifestData(items);

  console.log('🎉 Manifest processing complete');

  return { items, validation };
};

/**
 * Calculate load totals from extracted manifest items
 * Eliminates need for user to manually enter load details
 * @param items - Extracted manifest items
 * @returns Summary with total joints, length, and weight
 */
export const calculateLoadSummary = (items: ManifestItem[]): LoadSummary => {
  let totalJoints = 0;
  let totalLengthFt = 0;
  let totalWeightLbs = 0;

  items.forEach(item => {
    const qty = item.quantity || 1;
    const lengthFt = item.tally_length_ft || 0;
    const weightPerFoot = item.weight_lbs_ft || 0;

    totalJoints += qty;
    totalLengthFt += lengthFt * qty;
    totalWeightLbs += lengthFt * qty * weightPerFoot;
  });

  return {
    total_joints: totalJoints,
    total_length_ft: Math.round(totalLengthFt * 100) / 100,
    total_length_m: Math.round(totalLengthFt / 3.28084 * 100) / 100,
    total_weight_lbs: Math.round(totalWeightLbs),
    total_weight_kg: Math.round(totalWeightLbs / 2.20462)
  };
};

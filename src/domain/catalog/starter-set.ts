import type { FieldType, SelectOption } from "./field-definition";

/**
 * Optional jewelry starter set (spec 6.1), pre-filled in both languages.
 * `category: null` = field applies to every item; otherwise the category's `ref`.
 */
export interface StarterCategory {
  ref: string;
  nameBn: string;
  nameEn: string;
}

export interface StarterField {
  category: string | null;
  key: string;
  labelBn: string;
  labelEn: string;
  type: FieldType;
  unitBn?: string;
  unitEn?: string;
  options?: SelectOption[];
  isRequired?: boolean;
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  { ref: "gold", nameBn: "সোনা", nameEn: "Gold" },
  { ref: "silver", nameBn: "রুপা", nameEn: "Silver" },
  { ref: "diamond", nameBn: "হীরা", nameEn: "Diamond" },
  { ref: "other", nameBn: "অন্যান্য", nameEn: "Other" },
];

const karat = (k: string): SelectOption => ({ value: k, labelBn: k.replace("K", " ক্যারেট"), labelEn: k });

export const STARTER_FIELDS: readonly StarterField[] = [
  { category: null, key: "weight", labelBn: "ওজন", labelEn: "Weight", type: "decimal", unitBn: "গ্রাম", unitEn: "g" },
  { category: null, key: "making_charge", labelBn: "মজুরি", labelEn: "Making charge", type: "money" },
  {
    category: "gold",
    key: "karat",
    labelBn: "ক্যারেট",
    labelEn: "Karat",
    type: "select",
    options: ["18K", "21K", "22K", "24K"].map(karat),
  },
];

import { z } from "zod";
import { optionalMoneyField, optionalNidField, optionalPhoneField, optionalText, phoneField } from "./fields";

/** Customer form (spec 6.2): phone required; everything else optional. */
export const customerFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameBn: optionalText(120),
  phone: phoneField(),
  altPhone: optionalPhoneField(),
  address: optionalText(500),
  nidNumber: optionalNidField(),
  guarantorName: optionalText(120),
  guarantorPhone: optionalPhoneField(),
  guarantorRelation: optionalText(60),
  creditLimit: optionalMoneyField(),
  notes: optionalText(2000),
});

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormValues = z.output<typeof customerFormSchema>;

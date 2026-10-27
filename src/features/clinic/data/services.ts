import type { Service } from "../types";

/** Treatments offered by the clinic, in display order. */
export const SERVICES: readonly Service[] = [
  {
    name: "General Dentistry",
    text: "Routine dental checkups and consultations with an experienced general dentist to keep your whole family's teeth healthy.",
  },
  {
    name: "Teeth Cleaning",
    text: "Professional dental scaling and polishing for tartar removal, fresher breath and healthier gums.",
  },
  {
    name: "Tooth Filling",
    text: "Tooth-coloured dental fillings for cavity treatment that look natural and last for years.",
  },
  {
    name: "Root Canal",
    text: "Painless root canal treatment (RCT) with modern equipment to save your natural tooth.",
  },
  {
    name: "Tooth Extraction",
    text: "Gentle, painless tooth extraction including wisdom tooth removal.",
  },
  {
    name: "Dental Crowns",
    text: "Strong, natural-looking dental crowns (tooth caps) to protect and restore weak teeth.",
  },
  {
    name: "Teeth Whitening",
    text: "Professional teeth whitening and bleaching for a visibly brighter smile.",
  },
  {
    name: "Gum Treatment",
    text: "Gum disease treatment for bleeding gums and swollen gums before they cause tooth loss.",
  },
  {
    name: "Dentures",
    text: "Comfortable full and partial removable dentures — artificial teeth that fit well and look real.",
  },
  {
    name: "Children's Dentistry",
    text: "Friendly pediatric dental care so kids feel safe and enjoy their dental visits.",
  },
  {
    name: "Dental Emergencies",
    text: "Emergency dentist care for severe toothache, injuries and emergency tooth extraction.",
  },
  {
    name: "Cosmetic Dentistry",
    text: "Smile makeovers and chipped tooth repair by a caring cosmetic dentist.",
  },
  {
    name: "Tooth Sensitivity",
    text: "Relief from sensitive teeth — we find the cause and treat it properly.",
  },
  {
    name: "Bad Breath",
    text: "Bad breath (halitosis) treatment that targets the root cause, not just the symptoms.",
  },
  {
    name: "Broken Teeth",
    text: "Broken tooth treatment and cracked tooth repair to restore strength and appearance.",
  },
];

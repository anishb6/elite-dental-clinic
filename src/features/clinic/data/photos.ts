import type { LabelledPhoto, Photo } from "../types";

/** Image files live in `/public` and are referenced by absolute path. */

export const CLINIC_PHOTOS = [
  {
    src: "/treatment-room.jpg",
    alt: "Inside Elite Dental Clinic's treatment room",
    label: "Treatment room",
  },
  {
    src: "/clinic-entrance.jpg",
    alt: "Entrance to Elite Dental Clinic, Barasat",
    label: "Clinic entrance",
  },
] as const satisfies readonly LabelledPhoto[];

/** Named picks from the lists above, so pages never rely on magic array indexes. */
export const HERO_PHOTO = CLINIC_PHOTOS[0];
export const ABOUT_PHOTO = CLINIC_PHOTOS[1];

export const DOCTOR_PHOTO: Photo = {
  src: "/dr-debayan-saha.jpg",
  alt: "Dr. Debayan Saha, dentist at Elite Dental Clinic in Barasat",
};

export const TREATMENT_PHOTOS: readonly LabelledPhoto[] = [
  {
    src: "/cavity-restoration.jpg",
    alt: "Dental cavity and restoration treatment photographs",
    label: "Cavity restoration",
  },
  {
    src: "/child-tooth-restoration.jpg",
    alt: "Primary tooth before and after restoration",
    label: "Primary tooth restoration",
  },
  {
    src: "/smile-before-after.jpg",
    alt: "Patient smile before and after dental treatment",
    label: "Smile before & after",
  },
  {
    src: "/restorative-treatment.jpg",
    alt: "Teeth before and after restorative treatment",
    label: "Restorative treatment",
  },
  {
    src: "/broken-tooth-restoration.jpg",
    alt: "Broken teeth before and after restoration",
    label: "Tooth restoration",
  },
  {
    src: "/scaling-before-after.jpg",
    alt: "Patient teeth before and after full-mouth scaling",
    label: "Scaling before & after",
  },
  {
    src: "/premolar-restoration.jpg",
    alt: "Cavitated premolar before and after restoration and build-up",
    label: "Premolar restoration",
  },
  {
    src: "/smile-comparison.jpg",
    alt: "Two photographs comparing a patient's smile",
    label: "Smile comparison",
  },
];

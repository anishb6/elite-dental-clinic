import entrance from "@/assets/clinic-entrance.jpg.asset.json";
import room from "@/assets/treatment-room.jpg.asset.json";
import cavity from "@/assets/cavity-restoration.jpg.asset.json";
import child from "@/assets/child-tooth-restoration.jpg.asset.json";
import smile from "@/assets/smile-before-after.jpg.asset.json";
import restorative from "@/assets/restorative-treatment.jpg.asset.json";
import broken from "@/assets/broken-tooth-restoration.jpg.asset.json";
import scaling from "@/assets/scaling-before-after.jpg.asset.json";
import premolar from "@/assets/premolar-restoration.jpg.asset.json";
import comparison from "@/assets/smile-comparison.jpg.asset.json";
import doctor from "@/assets/dr-debayan-saha.jpg.asset.json";

export const CLINIC_PHOTOS = [
  { src: room.url, alt: "Inside Elite Dental Clinic's treatment room", label: "Treatment room" },
  { src: entrance.url, alt: "Entrance to Elite Dental Clinic, Barasat", label: "Clinic entrance" },
] as const;

export const DOCTOR_PHOTO = {
  src: doctor.url,
  alt: "Dr. Debayan Saha, dentist at Elite Dental Clinic in Barasat",
};

export const TREATMENT_PHOTOS = [
  { src: cavity.url, alt: "Dental cavity and restoration treatment photographs", label: "Cavity restoration" },
  { src: child.url, alt: "Primary tooth before and after restoration", label: "Primary tooth restoration" },
  { src: smile.url, alt: "Patient smile before and after dental treatment", label: "Smile before & after" },
  { src: restorative.url, alt: "Teeth before and after restorative treatment", label: "Restorative treatment" },
  { src: broken.url, alt: "Broken teeth before and after restoration", label: "Tooth restoration" },
  { src: scaling.url, alt: "Patient teeth before and after full-mouth scaling", label: "Scaling before & after" },
  { src: premolar.url, alt: "Cavitated premolar before and after restoration and build-up", label: "Premolar restoration" },
  { src: comparison.url, alt: "Two photographs comparing a patient's smile", label: "Smile comparison" },
];
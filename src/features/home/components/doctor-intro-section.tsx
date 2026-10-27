import { Link } from "@tanstack/react-router";
import { CLINIC } from "@/config/site";
import { DOCTOR_PHOTO } from "@/features/clinic/data/photos";

export function DoctorIntroSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 grid gap-14 md:grid-cols-2 items-center">
      <img
        src={DOCTOR_PHOTO.src}
        alt={DOCTOR_PHOTO.alt}
        loading="lazy"
        width={900}
        height={1200}
        className="mx-auto aspect-[3/4] w-full max-w-sm rounded-sm object-cover object-top shadow-2xl"
      />
      <div>
        <p className="eyebrow">Meet your dentist</p>
        <h2 className="mt-4 text-4xl md:text-6xl">{CLINIC.doctor}</h2>
        <p className="mt-6 text-lg text-muted-foreground">
          Every patient deserves to feel calm, heard and cared for. At Elite Dental Clinic we
          combine modern equipment with an unhurried, honest approach — so you always understand
          your treatment.
        </p>
        <Link to="/about" className="btn-outline mt-8">
          About the clinic
        </Link>
      </div>
    </section>
  );
}

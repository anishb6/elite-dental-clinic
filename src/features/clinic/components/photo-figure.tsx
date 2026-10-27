import type { LabelledPhoto } from "../types";

type PhotoFigureProps = {
  photo: LabelledPhoto;
  width: number;
  height: number;
  /** Tailwind aspect-ratio class for the image box. */
  aspectClass: string;
};

export function PhotoFigure({ photo, width, height, aspectClass }: PhotoFigureProps) {
  return (
    <figure className="overflow-hidden bg-card">
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        width={width}
        height={height}
        className={`${aspectClass} w-full object-contain`}
      />
      <figcaption className="p-4 eyebrow">{photo.label}</figcaption>
    </figure>
  );
}

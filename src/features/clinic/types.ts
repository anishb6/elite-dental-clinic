export type Service = { readonly name: string; readonly text: string };
export type Review = { readonly name: string; readonly text: string };
export type Photo = { readonly src: string; readonly alt: string };
export type LabelledPhoto = Photo & { readonly label: string };

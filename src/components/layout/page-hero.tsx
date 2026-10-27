type PageHeroProps = { eyebrow: string; title: string; text?: string };

export function PageHero({ eyebrow, title, text }: PageHeroProps) {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-14 sm:py-20 md:py-28">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-4xl sm:text-5xl md:text-7xl max-w-3xl">{title}</h1>
        {text && <p className="mt-6 max-w-2xl opacity-75 text-base sm:text-lg">{text}</p>}
      </div>
    </section>
  );
}

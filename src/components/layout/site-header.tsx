import { Link } from "@tanstack/react-router";
import { CLINIC, NAV_ITEMS } from "@/config/site";
import { useDisclosure } from "@/hooks/use-disclosure";

export function SiteHeader() {
  const menu = useDisclosure();

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        <Link to="/" className="leading-tight">
          <span className="block font-serif text-xl sm:text-2xl">{CLINIC.name}</span>
          <span className="block text-[0.65rem] tracking-[0.3em] uppercase text-gold">
            {CLINIC.doctor} · {CLINIC.city}
          </span>
        </Link>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-8 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              className="opacity-80 hover:opacity-100 [&.active]:text-gold [&.active]:opacity-100"
            >
              {item.label}
            </Link>
          ))}
          <Link to="/book" className="btn-gold">
            Book Now
          </Link>
        </nav>

        <button
          className="lg:hidden text-sm tracking-widest uppercase px-3 py-3 -mr-3"
          onClick={menu.toggle}
          aria-label="Menu"
          aria-expanded={menu.isOpen}
        >
          {menu.isOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menu.isOpen && (
        <nav
          aria-label="Mobile"
          className="lg:hidden border-t border-primary-foreground/10 px-5 py-3 flex flex-col"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={menu.close}
              activeOptions={{ exact: true }}
              className="py-3 border-b border-primary-foreground/10 [&.active]:text-gold"
            >
              {item.label}
            </Link>
          ))}
          <Link to="/book" onClick={menu.close} className="btn-gold mt-4 mb-2 text-center">
            Book Now
          </Link>
        </nav>
      )}
    </header>
  );
}

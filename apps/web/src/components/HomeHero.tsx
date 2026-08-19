const HERO_ICONS = ['🍽️', '🥗', '⚖️', '📅'];

export function HomeHero() {
  return (
    <div className="home-hero">
      <div className="home-hero-icons">
        {HERO_ICONS.map((icon) => (
          <span className="home-hero-icon" key={icon}>
            {icon}
          </span>
        ))}
      </div>
      <h1 className="home-hero-title">Meal Planning &amp; Tracking</h1>
      <p className="home-hero-subtitle">Plan smarter, eat better, every day.</p>
    </div>
  );
}

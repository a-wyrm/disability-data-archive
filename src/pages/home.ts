import { getDevRevision } from "../app.js";
export type HomeStats = {
  rescuedDatasets: number;
  volunteers: number;
};

export function HomePage({ rescuedDatasets, volunteers }: HomeStats) {
  return `
    <link rel="stylesheet" href="/static/css/home.css?v=${getDevRevision()}">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy">
        <h1 id="home-title">Preserving vulnerable disability data.</h1>
        <p class="home-lede">
          Explore rescued datasets, help us identify data at risk, and keep disability data open and available for everyone.
        </p>
        <div class="home-actions">
          <a class="contrast" role="button" href="/datasets">Browse datasets</a>
          <a href="/submit">Help rescue data</a>
        </div>
      </div>

    </section>

    <section class="home-stats" aria-label="Archive statistics">
      <div class="home-stat">
        <strong>${rescuedDatasets.toLocaleString()}</strong>
        <span>rescued datasets</span>
      </div>
      <div class="home-stat">
        <strong>${volunteers.toLocaleString()}</strong>
        <span>volunteers</span>
      </div>
    </section>

    <section class="home-browse" aria-labelledby="browse-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Explore the archive</p>
        </div>
      </div>
      <div class="home-browse-grid">
        <a class="home-browse-card home-browse-card-featured" href="/datasets">
          <span class="home-card-number">01</span>
          <div>
            <h3>Browse datasets</h3>
            <p>Search the rescued disability data currently available in the archive.</p>
          </div>
          <span class="home-card-arrow" aria-hidden="true">↗</span>
        </a>
        <article class="home-browse-card" aria-labelledby="categories-title">
          <span class="home-card-number">02</span>
          <div>
            <h3 id="categories-title">Browse categories</h3>
            <p>Organized views by topic are coming soon.</p>
          </div>
          <span class="home-card-status">Coming soon</span>
        </article>
        <article class="home-browse-card" aria-labelledby="offices-title">
          <span class="home-card-number">03</span>
          <div>
            <h3 id="offices-title">Browse offices</h3>
            <p>Explore data by agency or office when this view is ready.</p>
          </div>
          <span class="home-card-status">Coming soon</span>
        </article>
      </div>
    </section>

    <section class="home-callout" aria-labelledby="home-callout-title">
      <div>
        <h2 id="home-callout-title">Know about disability data that should be preserved?</h2>
      </div>
      <a href="/submit">Submit a dataset</a>
    </section>
  `;
}

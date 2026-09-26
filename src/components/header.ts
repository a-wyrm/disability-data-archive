export function Header() {
  return `
        <header class="container">
            <nav>
                <ul>
                    <li><strong><a href="/">Disability Data Archive</a></strong></li>
                </ul>
                <ul>
                    <li><a href="/datasets">Datasets</a></li>
                    <li><a href="/about">About</a></li>
                    <li><a href="/records">Contact</a></li>
                    <li>
                        <div class="tag-select-container">
                            <input class="tag-input" placeholder="search bar..."> </input>
                        </div>
                    </li>
                </ul>

            </nav>
        </header>
    `;
}

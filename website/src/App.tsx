import {
  ArrowDown,
  ArrowRight,
  Blocks,
  Check,
  ChevronRight,
  Cpu,
  Download,
  Gamepad2,
  Github,
  Layers3,
  Menu,
  Moon,
  MonitorDown,
  PackageOpen,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const repository = import.meta.env.VITE_GITHUB_REPOSITORY?.trim();
const logoUrl = `${import.meta.env.BASE_URL}logo.png`;
const repositoryParts = repository?.match(/^([\w.-]+)\/([\w.-]+)$/);
const releasesApiUrl = repositoryParts
  ? `https://api.github.com/repos/${encodeURIComponent(repositoryParts[1])}/${encodeURIComponent(repositoryParts[2])}/releases?per_page=100`
  : undefined;

type DownloadState =
  | { status: 'loading' }
  | { status: 'available'; url: string }
  | { status: 'unavailable'; message: string };

interface GitHubRelease {
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
}

const features = [
  {
    icon: Layers3,
    title: 'Every world, organized',
    copy: 'Keep vanilla, Fabric, Forge, and your experiments in tidy, separate instances.',
    color: 'mint',
  },
  {
    icon: PackageOpen,
    title: 'Find your next favorite',
    copy: 'Explore mods and modpacks from Modrinth and CurseForge without leaving the launcher.',
    color: 'gold',
  },
  {
    icon: Cpu,
    title: 'Your setup, understood',
    copy: 'See Java and system readiness, then tune memory and graphics for your machine.',
    color: 'blue',
  },
  {
    icon: ShieldCheck,
    title: 'Your account stays yours',
    copy: 'Choose a Microsoft account or create an offline profile, with credentials handled carefully.',
    color: 'purple',
  },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    window.localStorage.getItem('the-boys-website-theme') === 'light' ? 'light' : 'dark',
  );
  const [downloadState, setDownloadState] = useState<DownloadState>(() =>
    releasesApiUrl
      ? { status: 'loading' }
      : { status: 'unavailable', message: 'Add a valid GitHub repository to enable downloads.' },
  );
  const [retryCount, setRetryCount] = useState(0);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!releasesApiUrl) return;

    const controller = new AbortController();
    setDownloadState({ status: 'loading' });

    void fetch(releasesApiUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`GitHub returned ${response.status}`);
        }

        const releases: GitHubRelease[] = await response.json();
        const installer = releases
          .flatMap((release) => release.assets ?? [])
          .find((asset) =>
            typeof asset.name === 'string'
            && /\.exe$/i.test(asset.name)
            && typeof asset.browser_download_url === 'string',
          );

        if (!installer?.browser_download_url) {
          setDownloadState({
            status: 'unavailable',
            message: 'No published release includes a Windows installer yet.',
          });
          return;
        }

        setDownloadState({ status: 'available', url: installer.browser_download_url });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        setDownloadState({
          status: 'unavailable',
          message: error instanceof Error
            ? error.message
            : 'Could not load the latest Windows installer.',
        });
      });

    return () => controller.abort();
  }, [retryCount]);

  const downloadAction = (className: string) => {
    if (downloadState.status === 'available') {
      return (
        <a className={className} href={downloadState.url}>
          <Download size={19} /> Download for Windows <ArrowRight size={18} />
        </a>
      );
    }

    return (
      <button
        className={`${className} button-disabled`}
        type="button"
        disabled={downloadState.status === 'loading'}
        aria-live="polite"
        title={downloadState.status === 'unavailable' ? downloadState.message : undefined}
        onClick={() => setRetryCount((count) => count + 1)}
      >
        <MonitorDown size={19} />
        {downloadState.status === 'loading' ? 'Finding latest installer…' : 'Installer unavailable — retry'}
      </button>
    );
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('the-boys-website-theme', theme);
  }, [theme]);

  return (
    <main data-theme={theme}>
      <header className="topbar">
        <a className="brand" href="#top" onClick={closeMenu} aria-label="The Boys home">
          <img src={logoUrl} alt="" />
          <span>
            <strong>THE BOYS</strong>
            <small>MINECRAFT CLIENT</small>
          </span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'}>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
          <button
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-pressed={theme === 'light'}
            className="theme-toggle"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            type="button"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <a
            aria-label="View The Boys source code on GitHub"
            className="github-link"
            href={`https://github.com/${repository ?? 'ktesla39/the-boyz'}`}
            onClick={closeMenu}
            rel="noreferrer"
            target="_blank"
          >
            <Github size={18} /> Source
          </a>
          {releasesApiUrl ? (
            downloadAction('button button-small')
          ) : (
            <span className="release-unconfigured">Releases coming soon</span>
          )}
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> YOUR NEXT WORLD STARTS HERE</div>
          <h1>A better way<br />to play <span>Minecraft.</span></h1>
          <p className="hero-lede">
            Your instances, mods, and settings — all in one calm, crafted place. Less setup.
            More time in the world you came to build.
          </p>
          <div className="hero-actions">
            {releasesApiUrl ? (
              downloadAction('button button-primary')
            ) : (
              <div className="button button-disabled" aria-disabled="true">
                <MonitorDown size={19} /> Add GitHub repo in .env to enable downloads
              </div>
            )}
            <a className="text-link" href="#features">Take a look <ArrowDown size={16} /></a>
          </div>
          <div className="hero-note">
            <span><Check size={14} /> Windows desktop</span>
            <span><Check size={14} /> Free to use</span>
            <span><Check size={14} /> Open release notes</span>
          </div>
        </div>

        <div className="hero-art" aria-label="Stylized launcher preview">
          <div className="pixel-sun" />
          <div className="mountains mountain-back" />
          <div className="mountains mountain-front" />
          <div className="voxel-tree tree-one"><i /><b /></div>
          <div className="voxel-tree tree-two"><i /><b /></div>
          <div className="voxel-ground" />
          <div className="game-window">
            <div className="window-titlebar">
              <span className="window-dots"><i /><i /><i /></span>
              <span>THE BOYS <small>— PLAY</small></span>
              <Gamepad2 size={17} />
            </div>
            <div className="window-content">
              <div className="window-side">
                <div className="mini-brand"><img src={logoUrl} alt="" /></div>
                <i className="side-active" /><i /><i /><i />
                <div className="avatar">B</div>
              </div>
              <div className="window-main">
                <div className="window-kicker"><Blocks size={14} /> MINECRAFT: JAVA EDITION</div>
                <h2>Make this<br />world yours.</h2>
                <div className="world-card">
                  <div className="world-thumb"><span>✦</span></div>
                  <div><strong>My Survival World</strong><small>FABRIC · 1.21.4</small></div>
                  <ChevronRight size={17} />
                </div>
                <div className="play-row"><span><i /> READY TO PLAY</span><button type="button"><Gamepad2 size={15} /> PLAY</button></div>
              </div>
            </div>
          </div>
          <div className="float-chip chip-top"><Sparkles size={16} /> Built for your next big idea</div>
          <div className="float-chip chip-bottom"><span className="chip-square" /> Worlds, neatly in order</div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Launcher capabilities">
        <p>MADE FOR THE WAY YOU PLAY</p>
        <div><span>VANILLA</span><b /> <span>FABRIC</span><b /> <span>FORGE</span><b /> <span>NEOFORGE</span></div>
      </section>

      <section className="features section-wrap" id="features">
        <div className="section-heading">
          <div className="eyebrow">A TOOLBELT FOR YOUR WORLDS</div>
          <h2>Everything in its<br /><span>right place.</span></h2>
          <p>Thoughtful tools for the little things that make every play session feel like yours.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, copy, color }, index) => (
            <article className={`feature-card ${color}`} key={title}>
              <div className="feature-top"><span className="feature-icon"><Icon size={22} /></span><small>0{index + 1}</small></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="card-corner" />
            </article>
          ))}
        </div>
      </section>

      <section className="split-section section-wrap" id="how-it-works">
        <div className="split-visual">
          <div className="crafting-board">
            <div className="crafting-heading"><Blocks size={17} /> YOUR INSTANCE WORKSPACE</div>
            <div className="instance-row"><span className="block-icon grass">▦</span><span><b>Chill survival</b><small>Vanilla · 1.21.4</small></span><i className="ready-pill">READY</i></div>
            <div className="instance-row"><span className="block-icon amethyst">✧</span><span><b>Shimmering skies</b><small>Fabric · 1.20.1</small></span><i className="ready-pill">READY</i></div>
            <div className="instance-row"><span className="block-icon copper">⌘</span><span><b>Redstone lab</b><small>Forge · 1.19.2</small></span><i className="ready-pill">READY</i></div>
            <div className="crafting-foot"><span>3 WORLDS · ALL YOURS</span><span>+</span></div>
          </div>
        </div>
        <div className="split-copy">
          <div className="eyebrow">KEEP YOUR WORLDS YOURS</div>
          <h2>Pick up where<br />your imagination <span>left off.</span></h2>
          <p>Give every idea its own space. Keep versions, mod loaders, and Java settings organized, so changing worlds never means untangling your setup.</p>
          <a className="inline-link" href="#download">Meet your new home <ArrowRight size={17} /></a>
        </div>
      </section>

      <section className="cta-section section-wrap" id="download">
        <div className="cta-glow" />
        <div className="eyebrow">YOUR NEXT ADVENTURE IS CLOSER</div>
        <h2>Ready when<br />you are.</h2>
        <p>Bring your ideas. The Boys will help with the rest.</p>
        {releasesApiUrl ? (
          downloadAction('button button-primary')
        ) : (
          <p className="config-hint">Set <code>VITE_GITHUB_REPOSITORY</code> in <code>.env</code> to publish the release download.</p>
        )}
        <small>Always check release notes before installing an update.</small>
      </section>

      <section className="faq section-wrap" id="faq">
        <div className="eyebrow">A FEW QUICK ANSWERS</div>
        <h2>Good to know.</h2>
        <div className="faq-grid">
          <article><h3>Is The Boys affiliated with Mojang or Microsoft?</h3><p>No. The Boys is an independent, community-made launcher and is not affiliated with Mojang or Microsoft.</p></article>
          <article><h3>Does this launcher include Minecraft?</h3><p>No. You need a valid Minecraft Java Edition installation and account for online play. The launcher helps organize your instances.</p></article>
          <article><h3>Can I use mods?</h3><p>Yes. Browse supported mods and modpacks, and keep each setup organized in its own instance.</p></article>
          <article><h3>Where can I see what's changed?</h3><p>Release notes and downloads are published with each GitHub release.</p></article>
        </div>
      </section>

      <footer className="footer">
        <a className="brand" href="#top">
          <img src={logoUrl} alt="" />
          <span><strong>THE BOYS</strong><small>MINECRAFT CLIENT</small></span>
        </a>
        <span>Made for the worlds you have yet to make.</span>
        <span className="footer-disclaimer">Not affiliated with Mojang or Microsoft.</span>
      </footer>
    </main>
  );
}

export default App;

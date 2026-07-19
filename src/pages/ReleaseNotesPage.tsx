import { useEffect } from "react";
import { IconArrowLeft, IconTag } from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";
import { LanguageToggle } from "../components/LanguageToggle";
import {
  CHANGE_CATEGORIES,
  getReleases,
  isEmptyRelease,
  isUpcoming,
  localizeChange,
  prNumbers,
  pullRequestUrl,
  type ChangeCategory,
  type LocalizedChange,
  type Release,
} from "../i18n/releaseNotes";

/** Route path for the standalone release notes page. */
export const RELEASE_NOTES_PATH = "/release-notes";

const CATEGORY_LABEL: Record<ChangeCategory, string> = {
  major: "Major",
  minor: "Minor",
  patch: "Patch",
};

const CATEGORY_ACCENT: Record<ChangeCategory, string> = {
  major: "var(--color-electric)",
  minor: "var(--color-neon)",
  patch: "var(--color-cyber)",
};

/** Renders the optional PR reference(s) for a change as GitHub links. */
function PrLinks({ change }: { change: LocalizedChange }) {
  const prs = prNumbers(change);
  if (prs.length === 0) {
    return null;
  }
  return (
    <>
      {prs.map((pr) => (
        <a
          key={pr}
          href={pullRequestUrl(pr)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1.5 align-baseline text-xs text-[var(--color-electric)] hover:text-[var(--color-neon)] hover:underline whitespace-nowrap"
          title={`Pull request #${pr}`}
        >
          #{pr}
        </a>
      ))}
    </>
  );
}

function CategoryGroup({
  category,
  release,
}: {
  category: ChangeCategory;
  release: Release;
}) {
  const { language, t } = useLanguage();
  const changes = release.changes[category] ?? [];
  if (changes.length === 0) {
    return null;
  }
  const accent = CATEGORY_ACCENT[category];
  return (
    <div className="mb-4 last:mb-0">
      <span
        className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
        style={{
          color: accent,
          backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
        }}
      >
        {t(CATEGORY_LABEL[category])}
      </span>
      <ul className="list-disc pl-5 space-y-1.5">
        {changes.map((change, i) => (
          <li
            key={i}
            className="text-sm text-[var(--color-text-secondary)] leading-relaxed"
          >
            {localizeChange(change, language)}
            <PrLinks change={change} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReleaseSection({ release }: { release: Release }) {
  const { t } = useLanguage();
  const upcoming = isUpcoming(release);
  const empty = isEmptyRelease(release);
  return (
    <section
      id={release.version}
      className="glass-card p-5 mb-6 scroll-mt-6 last:mb-0"
    >
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-medium text-[var(--color-text)] flex items-center gap-2">
          <IconTag size={18} className="text-[var(--color-electric)]" />
          {upcoming ? t("Upcoming") : release.version}
        </h2>
        {release.date && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {release.date}
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {upcoming
            ? t("No upcoming changes yet.")
            : t("No changes recorded for this release.")}
        </p>
      ) : (
        CHANGE_CATEGORIES.map((category) => (
          <CategoryGroup key={category} category={category} release={release} />
        ))
      )}
    </section>
  );
}

/**
 * Standalone, connection-independent release notes page served at
 * {@link RELEASE_NOTES_PATH}. Each release renders with `id={version}` so the
 * release CI's GitHub Release can deep-link to `#<version>`.
 */
export function ReleaseNotesPage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const releases = getReleases();

  // Deep links (e.g. #2026.04.01.0) — scroll the target into view once the
  // sections have rendered client-side.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (hash) {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-[var(--color-bg)]">
      <div className="absolute inset-0 bg-gradient-cyber opacity-20 pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="btn-ghost border border-[var(--color-border)] flex items-center gap-2 text-sm"
          >
            <IconArrowLeft size={18} />
            {t("Back")}
          </button>
          <LanguageToggle />
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-light tracking-wide text-[var(--color-text)]">
            {t("Release Notes")}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t("What's new in DYA Studio")}
          </p>
        </header>

        {releases.map((release) => (
          <ReleaseSection key={release.version} release={release} />
        ))}
      </div>
    </div>
  );
}

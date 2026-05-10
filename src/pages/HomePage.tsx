import {
  IconBrandGithub,
  IconShoppingCart,
  IconFile,
  IconBrandX,
  IconInfoCircle,
} from "@tabler/icons-react";

import DyaDashImg from "../assets/dya-dash/dya-dash.jpeg";
import DyaDashImg2 from "../assets/dya-dash/dya-dash2.jpeg";
import DyaDashImg3 from "../assets/dya-dash/dya-dash3.jpeg";
import DyaDashImg4 from "../assets/dya-dash/dya-dash4.jpeg";

const DyaDashImages = [DyaDashImg, DyaDashImg2, DyaDashImg3, DyaDashImg4];

import DYA2Img from "../assets/dya2/dya2.jpeg";
import DYA2Img2 from "../assets/dya2/dya2-2.jpeg";

const Dya2Images = [DYA2Img, DYA2Img2];

const xShareContents = {
  title: encodeURIComponent("DYA Studio for DYA & ZMK Keyboards"),
  link: encodeURIComponent("https://studio.dya.cormoran.works"),
  tags: "dya_studio,dy_kbd",
};
const xShareUrl = `https://twitter.com/intent/tweet?text=${xShareContents.title}&url=${xShareContents.link}&hashtags=${xShareContents.tags}`;

export function HomePage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1">
              <h1 className="text-xl font-medium text-[var(--color-text)] text-center tablet:text-left">
                Welcome to DYA Studio
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                DYA Studio is yet another
                <a
                  href="https://zmk.studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  ZMK Studio
                </a>
                for DYA keyboard series, designed by
                <a
                  href="https://x.com/cormoran707"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  cormoran707
                </a>
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <a
              href={xShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1 rounded bg-[var(--color-electric)] text-white hover:bg-[var(--color-neon)] transition-colors text-xs font-semibold"
              aria-label="Share on X"
            >
              Share on <IconBrandX size={16} className="ml-1" />
            </a>
          </div>
        </div>
        <div className="mb-4 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <IconInfoCircle size={14} /> DYA is pronounced "dia"
        </div>
        <div className="mb-4 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <IconInfoCircle size={14} /> cormoran
          is pronounced "cormoran" [kˈɔɚm(ə)rən]
        </div>

        {/* Guide */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            Features - What you can do with DYA Studio
          </h2>
          <div className="text-sm text-[var(--color-text-muted)] space-y-4">
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                <span className="text-[var(--color-text)]">
                  Customize keymaps with a slightly easier UI, equivalent to ZMK
                  Studio.
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  Configure trackball sensitivity, auto layer switching and
                  various input processor settings.
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  Check battery consumption history stored on the device.
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  Name BLE connection targets and unpair them.
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  Change various settings such as the time to enter sleep
                  mode.
                </span>
              </li>
            </ul>
            <p>See also below Q&amp;A section for more details.</p>
          </div>
        </div>

        {/* DYA Keyboards Section */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            DYA Keyboard series
            <a
              href="https://x.com/intent/tweet?hashtags=dya_kbd"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-xs text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
            >
              #dya_kbd
            </a>
          </h2>
          <div className="space-y-3">
            {/* DYA Dash */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] group flex-col sm:flex-row">
              <div className="flex flex-col flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      DYA Dash
                    </p>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      40% Split keyboard for mobile use.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <a
                      href="https://github.com/cormoran/dya-dash-keyboard"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconBrandGithub size={16} />
                      Design
                    </a>
                    <a
                      href="https://cormoran707.booth.pm/items/6913095"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconShoppingCart size={16} />
                      Buy
                    </a>
                    <a
                      href="https://cormoran.github.io/dya-dash-keyboard/"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconFile size={16} />
                      Docs
                    </a>
                  </div>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <div className="flex gap-4">
                    {DyaDashImages.map((src, index) => (
                      <img
                        key={index}
                        src={src}
                        width="256"
                        alt="DYA Dash"
                        className="max-w-full h-auto rounded flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* DY2 */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] group flex-col sm:flex-row">
              <div className="flex flex-col flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      DYA2
                    </p>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Next generation DYA keyboard, 60% split, standard
                      row-staggered layout.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <span className="text-xs font-medium uppercase text-[var(--color-cyber)]">
                      Coming Soon
                    </span>
                    <a
                      href="https://cormoran707.booth.pm/items/7627440"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconShoppingCart size={16} />
                      Watch Booth
                    </a>
                  </div>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <div className="flex gap-4">
                    {Dya2Images.map((src, index) => (
                      <img
                        key={index}
                        src={src}
                        width="256"
                        alt="DYA2"
                        className="max-w-full h-auto rounded flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            Q&amp;A
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                Q: Can my keyboard support DYA Studio?
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                A: Yes, you can use the keymap feature without any modification
                with your ZMK keyboard.
                <br />
                You can also support other features by using cormoran&apos;s ZMK
                fork and cormoran&apos;s ZMK modules, although it's{" "}
                <strong>not suggested</strong> considering compatibility and
                maintainability .
                <br />
                Please refer to the
                <a
                  href="https://github.com/cormoran/zmk-keyboard-dya-dash/pull/9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  experimental zmk-config
                </a>
                for DYA Dash keyboard.
                <div className="mt-2 p-3 rounded bg-[var(--color-warning)]/20 border border-[var(--color-warning)] text-[var(--color-warning)] text-xs">
                  <strong>Warning:</strong> cormoran's ZMK fork is very
                  experimental, optimized for DYA keyboards and may contain
                  unstable or breaking changes. Use at your own risk. In rare
                  cases, it may cause malfunction or damage to your keyboard
                  hardware.
                </div>
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                Q: Can I get source code of DYA Studio?
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                A: No, for now. DYA Studio is currently closed source to avoid
                people relying on my heavily customized zmk-fork. If you have
                feedback or feature request, please complaint on X with
                <a
                  href="https://x.com/intent/tweet?hashtags=dya_studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  #dya_studio
                </a>
                hashtag.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                Q: Are there plan to migrate the ZMK fork to ZMK v0.4.0?
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                A: Yes, I'm willing but not soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

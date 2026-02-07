import {
  IconBrandGithub,
  IconShoppingCart,
  IconFile,
} from "@tabler/icons-react";

import Keyket2026 from "../assets/keyket2026.jpeg";
import DyaDashImg from "../assets/dya-dash/dya-dash.jpeg";
import DyaDashImg2 from "../assets/dya-dash/dya-dash2.jpeg";
import DyaDashImg3 from "../assets/dya-dash/dya-dash3.jpeg";
import DyaDashImg4 from "../assets/dya-dash/dya-dash4.jpeg";

const DyaDashImages = [DyaDashImg, DyaDashImg2, DyaDashImg3, DyaDashImg4];

import DYA2Img from "../assets/dya2/dya2.jpeg";
import DYA2Img2 from "../assets/dya2/dya2-2.jpeg";

const Dya2Images = [DYA2Img, DYA2Img2];

export function HomePage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
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
              .
            </p>
          </div>
        </div>

        {/* DYA Keyboards Section */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            <span className="inline-block px-2 py-1 mb-2 rounded-full bg-[var(--color-electric)]/10 text-[var(--color-electric)] text-xs font-semibold tracking-wide uppercase mr-2">
              AD
            </span>
            DYA Keyboard は
            <a
              href="https://catalog.keyket.jp/tokyo-2026/exhibitor/A-06"
              target="_blank"
              className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
            >
              A-06 cormoran
            </a>
            で
            <a
              href="https://event.keyket.jp/tokyo-2026"
              target="_blank"
              className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
            >
              キーケット2026
            </a>
            に出展予定です
          </h2>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start justify-between p-4 rounded-lg group gap-4">
              <div className="flex-shrink-0">
                <a
                  href="https://catalog.keyket.jp/tokyo-2026/exhibitor/A-06"
                  target="_blank"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                >
                  <img
                    src={Keyket2026}
                    width="256"
                    alt="Keyket 2026"
                    className="max-w-full h-auto rounded"
                  />
                </a>
              </div>
              <div className="flex-1 text-sm text-[var(--color-text-muted)] ">
                <p className="mb-4">
                  キーケットでは DYA Studio に対応した DYA2 と DYA Dash
                  を販売予定です。
                </p>
                <p className="mb-4 ml-2">
                  DYA2 は打鍵感にこだわった Tadpole
                  マウント採用の据え置き向けキーボードです。
                  <br />
                  Cherry MX互換スイッチ対応で、配列は US,JIS
                  の両方に対応しています。
                </p>
                <p className="mb-4 ml-2">
                  DYA Dash は携帯しやすさを重視した設計のキーボードです。
                  <br />
                  Choc V2スイッチに対応しています。
                </p>
                <p className="mb-2">
                  どちらのキーボードも無線・分割・トラックボール・乾電池動作で、さらにタッチセンサーが搭載されています。
                </p>
                <p>
                  開発がうまく進めばどちらも半田付けの不要なビルドキットとなる予定です。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DYA Keyboards Section */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            DYA Keyboard series
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
                  href="https://github.com/cormoran/zmk-keyboard-dya-dash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  zmk-config
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
          </div>
        </div>
      </div>
    </div>
  );
}

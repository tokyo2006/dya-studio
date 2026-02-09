import {
  IconBrandGithub,
  IconShoppingCart,
  IconFile,
  IconBrandX,
  IconInfoCircle,
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
          <IconInfoCircle size={14} /> DYA の読み方はダイアです
        </div>
        <div className="mb-4 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <IconInfoCircle size={14} /> cormoran
          の読み方はコーモラン[kˈɔɚm(ə)rən]です
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
                  キーケットでは DYA2 と DYA Dash を販売予定です。
                </p>
                <p className="mb-4">
                  DYA2 は打鍵感にこだわった Tadpole
                  マウント採用の据え置き向けキーボードです。
                  <br />
                  Cherry MX互換スイッチ対応で、配列は US,JIS
                  の両方に対応しています。
                </p>
                <p className="mb-4">
                  DYA Dash は携帯しやすさを重視した設計のキーボードです。
                  <br />
                  Choc V2スイッチに対応しています。
                </p>
                <p className="mb-2">
                  どちらのキーボードも無線・分割・トラックボール・乾電池動作で、さらにタッチセンサーが搭載されています。
                </p>
                <p>どちらも半田付けの不要なビルドキットとなる予定です。</p>
              </div>
            </div>
          </div>
        </div>

        {/* Guide */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            Features - DYA Studio でできること
          </h2>
          <div className="text-sm text-[var(--color-text-muted)] space-y-4">
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                少し使いやすい UI で ZMK Studio
                と同等のキーマッピングカスタマイズができます
                <br />
                You can customize keymaps with a slightly easier UI, equivalent
                to ZMK Studio.
              </li>
              <li>
                トラックボールの感度や自動レイヤー切り替えの設定ができます
                <br />
                You can configure trackball sensitivity, auto layer switching
                and various input processor settings.
              </li>
              <li>
                デバイスに保存されたバッテリー消費履歴が確認できます
                <br />
                You can check battery consumption history stored on the device.
              </li>
              <li>
                BLE 接続先に名前をつけたり、ペアリングを解除したりできます
                <br />
                You can name BLE connection targets and unpair them.
              </li>
              <li>
                スリープに入る時間の変更など各種設定ができます
                <br />
                You can change various settings such as the time to enter sleep
                mode.
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

import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1">
              <h1 className="text-xl font-medium text-[var(--color-text)] text-center tablet:text-left">
                {t("home.welcome")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {t("home.dyaStudioDescription")}
                <a
                  href="https://zmk.studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  {t("home.zmkStudio")}
                </a>
                {t("home.designer")}
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
              aria-label={t("home.shareOnX")}
            >
              {t("home.shareOnX")} <IconBrandX size={16} className="ml-1" />
            </a>
          </div>
        </div>
        <div className="mb-4 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <IconInfoCircle size={14} /> {t("home.dyaPronounce")}
        </div>
        <div className="mb-4 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <IconInfoCircle size={14} /> {t("home.cormoranPronounce")}
        </div>

        {/* Guide */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("home.features")}
          </h2>
          <div className="text-sm text-[var(--color-text-muted)] space-y-4">
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                <span className="text-[var(--color-text)]">
                  {t("home.customizeKeymaps")}
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  {t("home.configureTrackball")}
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  {t("home.checkBattery")}
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  {t("home.nameBLEConnections")}
                </span>
              </li>
              <li>
                <span className="text-[var(--color-text)]">
                  {t("home.changeSettings")}
                </span>
              </li>
            </ul>
            <p>{t("home.seeQASection")}</p>
          </div>
        </div>

        {/* DYA Keyboards Section */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("home.dyaKeyboardSeries")}
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
                      {t("home.dyaDash")}
                    </p>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t("home.dyaDashDescription")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <a
                      href="https://github.com/cormoran/dya-dash-keyboard"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconBrandGithub size={16} />
                      {t("home.design")}
                    </a>
                    <a
                      href="https://cormoran707.booth.pm/items/6913095"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconShoppingCart size={16} />
                      {t("home.buy")}
                    </a>
                    <a
                      href="https://cormoran.github.io/dya-dash-keyboard/"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconFile size={16} />
                      {t("home.docs")}
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

            {/* DYA2 */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] group flex-col sm:flex-row">
              <div className="flex flex-col flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("home.dya2")}
                    </p>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t("home.dya2Description")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <span className="text-xs font-medium uppercase text-[var(--color-cyber)]">
                      {t("home.comingSoon")}
                    </span>
                    <a
                      href="https://cormoran707.booth.pm/items/7627440"
                      target="_blank"
                      className="flex items-center gap-1 underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors"
                    >
                      <IconShoppingCart size={16} />
                      {t("home.watchBooth")}
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
                {t("home.qKeyboardSupport")}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("home.aKeyboardSupportYes")}
                <br />
                {t("home.aKeyboardSupportAlso")}
                <br />
                {t("home.pleaseReferTo")}
                <a
                  href="https://github.com/cormoran/zmk-keyboard-dya-dash/pull/9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  {t("home.experimentalZmkConfig")}
                </a>
                {t("home.forDyaDashKeyboard")}
                <div className="mt-2 p-3 rounded bg-[var(--color-warning)]/20 border border-[var(--color-warning)] text-[var(--color-warning)] text-xs">
                  <strong>{t("home.warning")}:</strong> {t("home.warningText")}
                </div>
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                {t("home.qCanISourceCode")}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("home.aClosedSource")}
                <a
                  href="https://x.com/intent/tweet?hashtags=dya_studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                >
                  #dya_studio
                </a>
                {t("home.hashtag")}
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                {t("home.qPlanToMigrate")}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("home.aWillingButNotSoon")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

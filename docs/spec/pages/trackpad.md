# Trackpad

## 範囲・根拠

- 種別: `/trackpad`（`Trackpad` タブ、日本語 `トラックパッド`、中文 `触控板`）。同じ route が排他的に 2 つのパネルを出す。`tokyo2006__tps43`（Azoteq IQS5xx、優先）と、`tokyo2006__cirque`（Cirque Pinnacle、fallback）。両方を広告する firmware では TPS43 を選ぶ（[TrackpadPage](../../../src/pages/TrackpadPage.tsx) `TrackpadPage`）。
- 入口と利用者: 接続中の通常タブ（`Trackball` の次）。TPS43 は [tps43-input-module](https://github.com/tokyo2006/tps43-input-module) と `CONFIG_ZMK_TPS43_STUDIO_RPC=y`、Cirque は [cirque-input-module](https://github.com/tokyo2006/cirque-input-module) と `CONFIG_ZMK_CIRQUE_STUDIO_RPC=y` が必要。split では trackpad の反対側（dongle/central）から relay 越しに編集する。
- 確認: 2026-10-25、dya-studio `197d81d` / tps43-input-module `c05f2e6`。TPS43 はコード確認と jest（page / hook / classifier / correlator / Demo）まで。ブラウザでの実測と実機は未実施。Cirque の記述は 2026-10-02、`b438192` 基準の確認を保持している。
- 関連仕様: 共通の debounce 表示は [settings write](../modules/settings-write.md)、接続・unlock は [device session](../modules/device-session.md)、Subsystems の supported 判定は [Subsystems](subsystems.md)、pointer speed の変換は [input processing](../modules/input-processing.md)。

| 根拠 | ソースと symbol                                                                                                                                                                                                                                                                         | 根拠の内容                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| S1   | [TrackpadPage](../../../src/pages/TrackpadPage.tsx): `TrackpadPage`, `Tps43Panel`, `SourceSelector`, `sourceLabel`, `handleReset`                                                                                                                                                       | パネル選択、source 表示、ヘッダー操作、reset の確認      |
| S2   | [useTps43](../../../src/hooks/useTps43.ts): `refresh`, `loadSource`, `selectSource`, `write`, `reset`, `TPS43_DISCOVERY_WINDOW_MS`, `TPS43_RELAY_TIMEOUT_MS`                                                                                                                            | 発見、source 切替、debounce 書込み、relay 相関、エラー   |
| S3   | [Tps43GestureMap](../../../src/components/Tps43GestureMap.tsx): `Tps43GestureMap`, `GestureLayer`, `holdDash`, `handlePointerUp`                                                                                                                                                        | 静的マップ、試一下、結果表示                             |
| S4   | [tps43Gestures](../../../src/lib/tps43Gestures.ts): `classifyTps43Gesture`, `TPS43_TAP_MAX_DISTANCE`, `TPS43_TAP_MAX_DURATION_MS`, `TPS43_DEFAULT_PRESS_AND_HOLD_TIME`                                                                                                                  | クライアント側の近似判定                                 |
| S5   | [demo-tps43](../../../src/lib/transport/demo-tps43.ts): `Tps43Handler`, `TPS43_DEFAULT_STATE`, `TPS43_DEMO_RELAY_DELAY_MS`                                                                                                                                                              | Demo の local + peripheral source と relay 形状          |
| S6   | [tps43.proto](../../../proto/tokyo2006/tps43/tps43.proto)、firmware [tps43_handler.c](https://github.com/tokyo2006/tps43-input-module/blob/feat/studio-any-half/src/studio/tps43_handler.c)                                                                                             | source 付き GetInfo / GetState / SetState / Reset / 通知 |
| S7   | [useRuntimeInputProcessor](../../../src/hooks/useRuntimeInputProcessor.ts): `setScaling`, `InputProcessor.scaleMultiplier` / `scaleDivisor`                                                                                                                                             | pointer speed カードのデータ源と書込み先                 |
| S8   | [Trackpad page tests](../../../src/pages/__tests__/TrackpadPage.test.tsx)、[useTps43 tests](../../../src/hooks/__tests__/useTps43.test.tsx)、[map tests](../../../src/components/__tests__/Tps43GestureMap.test.tsx)、[gesture tests](../../../src/lib/__tests__/tps43Gestures.test.ts) | TPS43 ページの回帰根拠                                   |
| S9   | [tps43Relay](../../../src/lib/tps43Relay.ts): `Tps43RelayCorrelator`, `TPS43_SOURCE_ALL`、[demo-tps43 tests](../../../src/lib/transport/__tests__/demo-tps43.test.ts)                                                                                                                   | relay 相関と Demo の deferred/notification 経路          |
| S10  | [cirque.proto](../../../proto/tokyo2006/cirque/cirque.proto)、[useCirque](../../../src/hooks/useCirque.ts)、[cirque_handler.c](https://github.com/tokyo2006/cirque-input-module/blob/feat/dya-studio-rpc/src/studio/cirque_handler.c)                                                   | Cirque パネルの protocol と永続化                        |
| S11  | [useCirque](../../../src/hooks/useCirque.ts): `load`, `update`, `write`, `reset`, `clearSent`                                                                                                                                                                                           | Cirque の RPC、debounce、persist、エラー後の再同期       |

## 機能要求

| ID      | できるべきこと                                                                                                          | 出典・確度                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| TPS-R01 | TPS43 が central に直結していても、反対側の half にいても、同じ Trackpad ページで設定を編集できる                       | 明示要求（設計 6.2、本変更）       |
| TPS-R02 | source 番号をユーザーに選ばせず、`Main hand` / `Off hand` のラベルで現在の対象を示す。複数あるときだけ選択できる        | 明示要求（設計 6.3.4、本変更）     |
| TPS-R03 | どの half にも trackpad が無いときは「見つからない」状態を出し、エラーや loading と区別する                             | 明示要求（設計 8、本変更）         |
| TPS-R04 | 静的ジェスチャーマップと「試一下」を同じ図に持ち、設定の変更がマップへ反映される。v1 では swipe / pinch-zoom を描かない | 明示要求（設計 6.4、本変更）       |
| TPS-R05 | tap / two-finger tap / press-and-hold / scroll / palm と、hold・battery・sensitivity のプリセットを編集できる           | 明示要求（設計 6.4、本変更）       |
| TPS-R06 | 編集は 1.5 秒の debounce で RAM 適用と flash 保存を同時に行い、再起動後も残る                                           | 明示要求（設計 6.4）＋実装から推定 |
| TPS-R07 | Reset は trackpad を持つ half だけを既定値へ戻し、central の pointer speed は変更しない                                 | 明示要求（設計 6.3.5、本変更）     |
| TPS-R08 | central の runtime input processor 経由で pointer speed を変更できる。搭載していない firmware ではカードを出さない      | 明示要求（設計 5、本変更）         |
| TPS-R09 | Demo で local source と relay される peripheral source の両方を編集できる                                               | 明示要求（設計 6.4、本変更）       |
| PAD-R01 | Cirque トラックパッドのデータモード、感度、向き、タップ、スクロール、エッジモーション、速度を編集できる                 | 明示要求（Cirque 変更）            |
| PAD-R02 | Trackball タブと同じ見た目・操作感で、編集は自動で適用・保存される                                                      | 明示要求（Cirque 変更）            |
| PAD-R03 | 倍率・除数、タップ領域サイズ、エッジモーションのタイミングは折りたたみの `Advanced` にまとめる                          | 明示要求（Cirque 変更）            |
| PAD-R04 | 確認後に Cirque の firmware 既定値へ戻せる                                                                              | S10 reset から提案                 |
| PAD-R05 | Demo で実機なしに Cirque を操作できる                                                                                   | 明示要求（Cirque 変更）            |

## 前提・状態

パネル選択は subsystem の広告で決まる。TPS43 があれば TPS43 パネル、無ければ Cirque パネル。どちらも無い場合も Cirque パネルが「未対応」を表示する（TPS43 側の未対応分岐は `isAvailable` が真のときしか描画されないため到達しない。未解決を参照）。

TPS43 パネル:

- unsupported: `tokyo2006__tps43` を広告しない device では TPS43 固有の案内は出ず、Cirque パネルの `Trackpad subsystem is not available for your keyboard.` と **cirque-input-module** へのリンクになる。Reload / Reset / 設定カードは無い。
- loading: subsystem があり、初回の source 発見と `GetState` 応答前は `Loading trackpad settings...`。発見前は「trackpad 無し」と断定しない。
- legacy: 旧 firmware が `GetInfo` を拒否、または `getInfo` / `deferred` のどちらも返さない場合、hook は `GetState{source: 0}` を 1 回だけ probe する。成功すれば `Main hand` の単一 source として通常どおり表示し、失敗すれば「Update the firmware ...」の alert を出して loading を終える。
- no trackpad: 発見が完了し `sources` が 0 件でエラーが無いとき。`No trackpad found`、`The connected keyboard reported no TPS43 trackpad on either half. Check that the trackpad half is powered and connected.`、`Search again`（発見をやり直す）を出す。ヘッダーの Reload / Reset は描画されない。これは error ではなく、Reload で 2 秒の探索を暗黙に始めないための独立状態。
- ready: source チップ（1 件）またはセレクタ（2 件以上）、`Gesture map` カード、`Gestures` / `Comfort` / `Pointing` カード、pointer speed が使える firmware では `Speed` カード。
- dirty: 編集直後はヘッダーに `Pending...`、送信中は `Saving...`（`role="status"`）。idle では表示なし。dirty / saving 中は Reload 無効。Reset は無効化されないが、確定すると待機中の編集を破棄する。
- error: ページ上部の赤枠 alert（`role="alert"`）。自動では消えず、次の load / write / reset / source 切替で消える。
- locked: firmware は `ZMK_STUDIO_RPC_HANDLER_UNSECURED` で登録するため通常 unlock は不要。SECURED の firmware ではタブ共通の unlock 経路（S2 `useLockAwareCall`）に従う。
- empty: 「trackpad 無し」が empty。それ以外に空 state はない（`GetState` は常に全 field を返す）。
- Demo: Subsystems の Demo 切替 `TPS43 Trackpad`（index 19、既定 ON）。source 0（local）と source 1（peripheral）を持ち、selector が常に出る。

Cirque パネル:

- unsupported: `tokyo2006__cirque` を広告しない device では `Trackpad subsystem is not available for your keyboard.` とモジュールへのリンクを表示し、Reload / Reset と設定カードは出さない。
- loading: subsystem があり初回 `getState` 応答前は `Loading trackpad settings...`。
- ready: 6 枚のカード（Basic / Speed / Orientation / Tap / Scroll / Edge Motion）と閉じた `Advanced`。
- dirty: 編集直後はヘッダーに `Pending...`、送信中は `Saving...`（`role="status"`）。idle では表示なし。dirty 中は Reload 無効。
- error: ページ上部の赤枠 alert（`role="alert"`）。自動では消えず、次の load / write / reset 開始時に消える。
- locked: TPS43 と同じ。
- empty: 該当なし。state は常に全 field を返す（S10 `handle_get_state`）。
- Demo: Subsystems の Demo 切替 `Cirque Trackpad`（index 18、既定 ON）。

## 現行の機能仕様

### TPS43 パネル

| ID      | 前提 → 操作                                                                                                | 観測できる結果                                                                                                                                                                                         | 保存範囲・副作用                                                                                                                                                                          | 根拠  |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| TPS-001 | TPS43 subsystem ありでタブを開く                                                                           | `Trackpad found on:` の下に source チップ / セレクタ。`getState` の値を各 control に表示。旧 firmware では `Main hand` の単一 source になる                                                            | mount 時に `GetInfo{source: ALL}`。local は即答、peripheral は 2,000 ms の窓で通知を集める（`TPS43_DISCOVERY_WINDOW_MS`）。`GetInfo` 失敗時は `GetState{source: 0}` に fallback。読込のみ | S1/S2 |
| TPS-002 | source が 1 件                                                                                             | `Main hand`（source 0）または `Off hand`（source > 0）のチップ。数字や left / right は出さない                                                                                                         | なし                                                                                                                                                                                      | S1    |
| TPS-003 | source が 2 件以上                                                                                         | `Trackpad found on:` の横にセレクタ（`role="group"`、`aria-pressed`）。選択中の source を反転表示                                                                                                      | 選択で `selectSource`。待機中の編集を破棄し、対象 source を `GetState` で読み直す。読込中は既存値を消す                                                                                   | S1/S2 |
| TPS-004 | 発見完了・0 件・エラーなし                                                                                 | `No trackpad found` と説明、`Search again`。Reload / Reset / 設定カードは無い                                                                                                                          | `Search again` で `refresh()`（再発見 + 再読込）。Reload では発見を始めない                                                                                                               | S1/S2 |
| TPS-005 | `Tap to click` / `Two-finger tap` / `Press and hold` / `Two-finger scroll` / `Palm rejection` を切り替える | switch が切り替わり `Pending...`                                                                                                                                                                       | 1,500 ms 後に変更 field だけを 1 回の `SetState{persist: true, source}` で送る。device RAM 適用と flash 保存を同時に行う                                                                  | S1/S2 |
| TPS-006 | `Hold duration` の Short / Medium / Long                                                                   | 選択が反転し 150 / 250 / 400 ms を表示。どれにも一致しない値では `Custom ({{ms}} ms)` を併記                                                                                                           | `pressAndHoldTime` を書く。プリセット専用 RPC は無く raw field を書く                                                                                                                     | S1    |
| TPS-007 | `Battery saver` の Off / Balanced / Max                                                                    | 0 / 1 / 2 を選択。一致しない値では `Custom ({{value}})`                                                                                                                                                | `batterySaver` を書く。firmware が report rate / idle へ変換する                                                                                                                          | S1    |
| TPS-008 | `Sensitivity` の Low / Medium / High                                                                       | 1 / 3 / 5 を選択。一致しない値では `Custom ({{value}})`                                                                                                                                                | `sensitivity` を書く。firmware が bottom-beta / stationary threshold へ変換する                                                                                                           | S1    |
| TPS-009 | `Natural scrolling`                                                                                        | 両軸が true のときだけ ON。切り替えると 1 回の patch で `naturalScrollX` と `naturalScrollY` を同時に書く                                                                                              | TPS-005 と同じ debounce / persist                                                                                                                                                         | S1    |
| TPS-010 | pointer speed 対応 firmware（`cormoran_rip` があり processor が 1 件以上）                                 | `Speed` カード。`Pointer speed` 10–300%（step 5）と、必要なら `Pointer processor` の select                                                                                                            | slider で `setScaling(processor.id, percent, 100)`。TPS43 の state / flash には保存しない。表示は現在の scale を % に直し 10–300 に clamp する                                            | S1/S7 |
| TPS-011 | pointer speed 非対応 firmware                                                                              | `Speed` カード自体を出さない                                                                                                                                                                           | RPC なし                                                                                                                                                                                  | S1/S7 |
| TPS-012 | `Gesture map` を表示                                                                                       | 43 × 40 mm の pad、`Tap` / `Two-finger scroll` / `Hold {{ms}} ms` / `Palm` の静的層。設定が OFF の層は薄い色で残る                                                                                     | 値の変更に追従。デバイスへは書かない                                                                                                                                                      | S3    |
| TPS-013 | マップ上で 1F / 2F を選び、指をドラッグして離す                                                            | 軌跡と結果（`Tap` / `Two-finger tap` / `Hold` / `Scroll` + 軸 / `No gesture`）を表示。該当 toggle が OFF なら `disabled` を併記。`Recognition is approximate; IQS572 does the real gesture detection.` | クライアント側の近似のみ。実機の認識結果ではない。swipe / zoom の層は v1 に無い                                                                                                           | S3/S4 |
| TPS-014 | `Reset to defaults`                                                                                        | ブラウザの確認ダイアログ `Reset trackpad settings to firmware defaults? ... Pointer speed is not affected.`                                                                                            | 確定で待機中の編集を破棄し `Reset{factoryDefaults: true, source}`。firmware はその half の既定値へ戻し保存値を消去。キャンセルは RPC なし                                                 | S1/S2 |
| TPS-015 | `Reload`                                                                                                   | 対象 source を `GetState` で読み直す                                                                                                                                                                   | 既知の source が無ければ `refresh()` で再発見。pending / saving 中は無効                                                                                                                  | S1/S2 |
| TPS-016 | セレクタで別 source を選ぶ                                                                                 | ヘッダーの選択表示が変わり、`Loading trackpad settings...` の後に新しい値                                                                                                                              | それ以降の `SetState` / `Reset` は選択 source を宛先にする。古い source の遅れた応答は generation で捨てる                                                                                | S2    |
| TPS-017 | 応答が timeout / 対象が切断                                                                                | `The trackpad on the off hand did not respond (timed out after 6000 ms). It may be disconnected.`（local なら `the main hand`）                                                                        | 6,000 ms（`TPS43_RELAY_TIMEOUT_MS`）で失敗。別 source への fallback はしない                                                                                                              | S2    |
| TPS-018 | Demo で `TPS43 Trackpad` を ON                                                                             | `Main hand` と `Off hand` の 2 source。各 source は独立した state を持ち、書込みの応答は 20 ms の relay 遅延後に通知で返る                                                                             | Demo の疑似 firmware 内のみ。ページを離れると破棄                                                                                                                                         | S5/S9 |

### Cirque パネル

| ID      | 前提 → 操作                                                                                             | 観測できる結果                                                                                                                            | 保存範囲・副作用                                                                                                                                                                                                            | 根拠       |
| ------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| PAD-001 | 接続（subsystem あり）でタブを開く                                                                      | mount 時に一度 `getState`。値を各 control に表示                                                                                          | read のみ。タブ往復では再読込しない（タブ保持）                                                                                                                                                                             | S1/S11     |
| PAD-002 | switch / radio / slider / number を変更                                                                 | 表示値は即座に変わり `Pending...`                                                                                                         | 最後の変更から 1,500 ms 後に、変更した field だけを 1 回の `setState{persist:true}` で送る。device RAM 適用と flash 保存を同時に行う                                                                                        | S11        |
| PAD-003 | 送信中にさらに同じ field を変更                                                                         | 新しい値を表示し続ける                                                                                                                    | 応答後も新しい値は pending に残り、次の debounce で送る                                                                                                                                                                     | S11        |
| PAD-004 | Basic: `Data Mode` Absolute/Relative、`Sensitivity` 1x/2x                                               | radio（`aria-checked`）が切り替わる                                                                                                       | PAD-002                                                                                                                                                                                                                     | S1         |
| PAD-005 | Orientation: `Rotation` 0°/90°/180°/270°、`Invert X`/`Invert Y`/`Swap X/Y`                              | radio / switch                                                                                                                            | PAD-002。firmware は 0/90/180/270 以外を拒否                                                                                                                                                                                | S1/S10     |
| PAD-006 | Tap: `Tap to Click`、`Secondary Tap`、`Auxiliary Tap`、`Max Tap Duration` 50–1000 ms、`Tap and Drag`    | `Tap and Drag` ON の時だけ `Drag Timeout` 100–1000 ms を表示                                                                              | PAD-002。非表示中も値は保持                                                                                                                                                                                                 | S1         |
| PAD-007 | Scroll: 右端/上端スクロール、`Scroll Zone` 0–500、`Scroll Divisor` 1–64、`Invert Scroll`、`Drag Scroll` | switch / slider                                                                                                                           | PAD-002。`Drag Scroll` は drag-scroll モジュールの runtime 状態で、reset 対象外                                                                                                                                             | S1/S10     |
| PAD-008 | Edge Motion: `Edge Motion` ON で `Edge Zone` 0–500、`Edge Motion Speed` 1–50。`Sleep Mode`              | 依存 slider は ON の時だけ表示                                                                                                            | PAD-002                                                                                                                                                                                                                     | S1         |
| PAD-009 | Speed: `Pointer Speed` / `Scroll Speed` 0–100                                                           | slider                                                                                                                                    | PAD-002。firmware は 100 に丸める。reset 対象外                                                                                                                                                                             | S1/S10     |
| PAD-010 | `Advanced` を開き number input を編集                                                                   | 13 項目（タップ移動量、クリック時間、ドラッグ移動量、副/補助タップ領域の幅・高さ、エッジモーション間隔・開始遅延、相対/絶対の倍率・除数） | 入力中は自由に編集でき送信しない。blur / Enter で確定し、整数のみ min–max に丸めて PAD-002 へ（除数・倍率は 1 以上、その他 0 以上、上限は u16/u32）。空欄・小数は破棄して元の値を表示。丸めた結果が現在値と同じなら送らない | S1         |
| PAD-011 | `Reset to defaults` → dialog `Reset trackpad settings?` → `Reset to defaults`                           | 成功で dialog が閉じ、既定値を表示                                                                                                        | 待機中の編集を破棄し `reset{factoryDefaults:true}`。firmware は runtime を既定値に戻し保存値を消去。Speed と Drag Scroll は変わらない                                                                                       | S1/S11/S10 |
| PAD-012 | reset dialog で `Cancel` / Escape / 外側クリック                                                        | dialog が閉じる                                                                                                                           | RPC なし。reset 中は閉じられない                                                                                                                                                                                            | S1         |
| PAD-013 | `Reload`                                                                                                | `getState` で再読込                                                                                                                       | pending / saving 中は無効                                                                                                                                                                                                   | S1/S11     |
| PAD-014 | Subsystems タブ                                                                                         | `tokyo2006__cirque` / `tokyo2006__tps43` は `Already supported by DYA Studio` に含まれる                                                  | [CustomSubsystemsPage](../../../src/pages/CustomSubsystemsPage.tsx) `SUPPORTED_SUBSYSTEM_IDENTIFIERS`                                                                                                                       | —          |

## 代表ユーザーフロー

TPS43:

1. F1 local 編集（TPS-005/006）: Demo 接続 → `Trackpad` → `Main hand` チップを確認 → `Tap to click` を ON、`Hold duration` を Long（400 ms）→ `Pending...` → 約 1.5 秒で消える → `Reload` しても ON / 400 ms のまま。後始末: 元に戻す。
2. F2 peripheral source（TPS-003/016/017）: `Off hand` に切り替え → 一瞬 `Loading trackpad settings...` → `Two-finger scroll` を ON → `Saving...` が消えた後 `Reload` で ON を確認 → `Main hand` に戻すと、こちらの `Two-finger scroll` は変わっていない（source ごとに独立）。
3. F3 no trackpad（TPS-004）: trackpad を持たない half だけで構成した firmware（または 0 件を返す hook state）で開く → `No trackpad found` と `Search again`。ヘッダーに Reload / Reset は無い → `Search again` で loading に戻る。Demo は常に 2 source を返すため、この状態は Demo では作れない（page test で確認）。
4. F4 プリセットの外れ値（TPS-006/007/008）: `Hold duration` が 320 ms の state を表示 → Short/Medium/Long のどれも選択されず、`Custom (320 ms)` が出る → Medium を押すと 250 ms に変わる。
5. F5 try-it（TPS-013）: マップで 1F → 中央を短くタップ → `Tap`。`Tap to click` を OFF にして再度タップ → `Tap · disabled`。2F で大きく横へドラッグ → `Scroll · horizontal`。`Hold {{ms}} ms` のリングは `Hold duration` に追従して長さが変わる。
6. F6 reset（TPS-014）: `Two-finger tap` を ON → `Reset to defaults` → 確認ダイアログで Cancel → 何も変わらない → 再度開いて確定 → 既定値に戻る。`Speed` の `Pointer speed` は変わらない。
7. F7 pointer speed 非搭載（TPS-011）: runtime input processor の無い firmware で接続 → `Speed` カードが無い。他のカードと Reload / Reset は使える。

Cirque:

1. C1 編集と保存（PAD-001/002/005）: Demo 接続 → `Trackpad` → `Invert X` を ON、`Rotation` を 90° → `Pending...` → 約 1.5 秒後に表示が消える → 別タブに移って戻り、`Reload` しても ON / 90° のまま。後始末: 元に戻す。
2. C2 依存 control（PAD-006/008）: `Tap and Drag` OFF で `Drag Timeout` が無い → ON で 350ms が現れる → OFF で消える。
3. C3 Advanced の境界（PAD-010）: `Relative Divisor` を 4 にして確定 → 0 を入力して blur → 1 に丸めて送る。`Max Tap Movement` を空欄にして blur → 200 に戻り送信しない。
4. C4 リセット（PAD-011/012）: `Max Tap Duration` を 400ms にする → `Reset to defaults` → `Cancel` で何も変わらない → 再度開き確定 → 250ms に戻る。`Pointer Speed` は維持。
5. C5 unsupported: Subsystems の Demo 切替で `Cirque Trackpad` を OFF（TPS43 も OFF）→ 再接続 → `Trackpad` に未対応の案内と cirque-input-module へのリンク。

## 不変条件

- TPS-I01: 選択していない source へ書かない。`SetState` / `Reset` は常に `selectedSource` を宛先にする。確認: S2 `write` / `reset` が `source` を request に載せる。S8 hook test。
- TPS-I02: source 切替前に送った応答が、切替後の表示を巻き戻さない。防御: S2 `generationRef` を `selectSource` / `refresh` / 切断で進め、古い応答を捨てる。
- TPS-I03: 「発見前」と「trackpad 無し」を混同しない。防御: S2 `hasDiscovered` が真で `sources` が空のときだけ空状態を出す。S8 page test。
- TPS-I04: no-trackpad 状態で Reload が暗黙の再探索を始めない。防御: ヘッダー actions を描画せず、`Search again` だけが `refresh()` を呼ぶ。S8 page test。
- TPS-I05: Reset が pointer speed（別 subsystem）を書き換えない。確認: S1 `handleReset` は `reset()` だけを呼ぶ。S8 page test が `setScaling` 未呼出を検証。
- TPS-I06: firmware 拒否後に UI が device と異なる値を表示し続けない。防御: S2 `write` が拒否時に `getState` で再同期する。
- PAD-I01: 変更していない field を `setState` に含めない（他クライアント・firmware 側の値を上書きしない）。確認: S8 hook test が `scrollZone` 未送信を検証。
- PAD-I02: reset 確定前に RPC を送らない。確認: S8 page test。
- PAD-I03: 送信中に再編集した値を、古い送信の応答で巻き戻さない。防御: `clearSent` は送信値と一致する pending だけを消す。
- PAD-I04: firmware 拒否後に UI が device と異なる値を表示し続けない。防御: `write` が拒否時に `getState` で再同期。

## エラーと復帰

TPS43:

- 発見 RPC 例外 / 旧 firmware: `GetInfo` が失敗したら `GetState{source: 0}` を probe する。成功すれば単一の `Main hand` source として使う。失敗すれば `This keyboard's TPS43 firmware does not support Studio discovery. Update the firmware to configure the trackpad.` を alert に出し、`hasDiscovered=true`・sources 0 件で loading を終える（「trackpad 無し」とは区別し、error を出す）。
- 読み込み失敗: `Failed to load trackpad state: ...`。再編集または `Reload` で再試行。
- 書込み拒否: firmware のエラー文言を alert に表示。firmware は有効な field を適用済みのため `getState` で再同期した値を表示。
- relay timeout: 対象 source が 6 秒以内に答えないと `The trackpad on the off hand did not respond (timed out after 6000 ms). It may be disconnected.`。別 source に自動で切り替えない。
- 対象 half に trackpad が無い（例: dongle の source 0）: firmware の `local trackpad not found` を表示。クラッシュや trackpad 無し状態への遷移はしない。
- reset 失敗: alert に表示し、ページは元の値を維持。再度 `Reset to defaults` で再試行。
- lock / cancel: 共通の locked 文言（S2 `useLockAwareCall`）。
- 切断: pending を破棄し state / sources を消す。再接続で再発見。

Cirque:

- `setState` 拒否（例: firmware の `rotateDegrees failed (-22)`）: ページ alert に firmware の文言。firmware は有効な他 field を適用済みのため `getState` で再同期した値を表示。Demo では UI 上到達不能（rotation は radio のみ）、hook test で検証。
- RPC 例外 / timeout: `Failed to save trackpad settings: ...` / `Failed to load trackpad state: ...`。再編集または `Reload` で再試行。
- reset 失敗: dialog を開いたまま dialog 内とページに alert。再度確定で再試行。
- lock / cancel: 共通の locked 文言。
- 切断: pending を破棄し state を消す。

## 探索の観点

1. 2 source の Demo で source を素早く往復 → 前の source の遅れた応答が新しい source の値を上書きしないか（TPS-I02）。
2. `Saving...` 中に source を切り替える / Reset を押す → 待機中の編集が後から別 source へ送られないか。
3. no-trackpad 状態から `Search again` を連打 → loading と空状態が交互にちらつかず、Reload が無いままか。
4. `Hold duration` と try-it の境界: 150 ms 直下・直上、250 ms、260 ms、400 ms で tap / hold / none が仕様どおりか。2F で距離 21/22 px の境界。
5. 狭い画面幅でセレクタ、`Gesture map`、各カードが 1 列になり、確認ダイアログが画面外に出ないか。
6. ja / zh で `Off hand`、`Trackpad found on:`、プリセットの `Custom (...)` と `Runtime pointer speed` の未翻訳が混在しないか。

## 既知の受け入れ済み不具合

承認根拠を確認できたものはなし。

## 未解決・未検証

TPS43:

- 実機未検証: Sofle（local）の tap / two-finger tap / hold / scroll、Reset、再起動後の永続化、WDT/ESD 復帰、stuck button。Velvet（dongle + right peripheral）の source 発見、set/get/reset、再起動永続化、切断/再接続、スクロール、cursor jump、central processor の pointer speed。
- 未対応表示: どちらの subsystem も無い場合、TPS43 利用者にも cirque-input-module へのリンクが出る。`Tps43Panel` の `!isAvailable` 分岐は `TrackpadPage` が `isAvailable` のときだけ描画するため到達しない（不具合候補、未修正）。
- `Axes` カードは Switch X/Y、Flip X/Y（TPS43 の生軸設定）と runtime processor の Rotation (degrees) を公開する。`Advanced`（tap time / scroll divisor / hold ms / raw bottom-beta）は引き続き v1 deferred で、raw field は RPC / DT から到達できる。
- `Scroll speed` は `scroll_runtime_input_processor` を listener に追加して 10–300% で公開する。pointer speed も 10–300% に clamp し、編集時に `percent/100` で書き戻す。firmware の scale が範囲外のとき表示と実値が一致しない。説明 `Runtime pointer and scroll speed` の ja / zh 訳は追加済み。
- 最終 Sofle ファームウェアは main 分岐の driver を使うため、palm / battery saver / sensitivity の field を返さない。UI はこれらを検出して非表示にし、操作できないスイッチを出さない。
- try-it のしきい値は CSS px（20 / 22 px、260 ms）で、SVG の viewBox 座標とは一致しない。実際の指の移動量の近似であり、IQS572 の設定（距離・時間）を反映しない。hold は 260 ms 未満でも `pressAndHoldTime` 以上なら hold になる（Short/Medium を到達可能にするための偏差）。
- マップはキーボード操作で試せない。pointer cancel 時は trail を消す。dark/light と狭幅の見た目はブラウザ未確認。
- source は接続スロットであり物理的な左右ではない。`GetInfo` は shield / 名前を返さないため、`Main hand` / `Off hand` 以上の情報は出せない。
- `GetInfo` は触控板を持つ source だけを返す。1 件なら自動選択してセレクタを出さない。複数件のときだけ手動選択が必要（Demo は 2 source を同時に模擬するため両方出る）。
- 発見は 2 秒、relay 応答は 6 秒の固定値。多数 peripheral や遅い BLE での取りこぼしは未検証。v1 の `SetState` / `Reset` は broadcast で、応答の `source` で相関する（target 指定は無い）。
- Demo の source 1 への書込みは request 時点で即適用され、通知は後から届く。実機の「half が適用してから答える」順序との差は未検証。

Cirque:

- 実機未検証: absolute / relative 切替時の挙動、スプリット構成での relay 同期（firmware `cirque_relay_send_state`）、flash 保存後の電源断。
- slider の範囲は UI 側の選択で firmware 検証ではない（firmware は rotation と scroll divisor 以外を検証しない）。倍率・除数の実用範囲は未確認。
- データモードごとにどの設定が効くかを UI は区別していない（モジュール README の feature map 参照）。
- Version history（capture / restore）は未対応。

# Trackpad

## 範囲・根拠

- 種別: `/trackpad`（`Trackpad` タブ、日本語 `トラックパッド`、中文 `触控板`）。Cirque Pinnacle トラックパッドの `tokyo2006__cirque` custom subsystem を編集するページ。
- 入口と利用者: 接続中の通常タブ（`Trackball` の次）。firmware は [tokyo2006/cirque-input-module `feat/dya-studio-rpc`](https://github.com/tokyo2006/cirque-input-module/tree/feat/dya-studio-rpc) と `CONFIG_ZMK_CIRQUE_STUDIO_RPC=y` が必要。
- 確認: 2026-10-02、`b438192` 基準の `pr/trackpad-settings`。コード確認、jest、Demo でのブラウザ確認。実機トラックパッドは未実測。
- 関連仕様: 共通の debounce 表示は [settings write](../modules/settings-write.md)、接続・unlock は [device session](../modules/device-session.md)、Subsystems の supported 判定は [Subsystems](subsystems.md)。

| 根拠 | ソースと symbol                                                                                                                                                                                  | 根拠の内容                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| S1   | [TrackpadPage](../../../src/pages/TrackpadPage.tsx): `TrackpadPage`, `handleReset`, `Card` / `ToggleRow` / `SliderRow` / `ChoiceRow` / `NumberRow`                                               | 画面構成、入力範囲、reset dialog            |
| S2   | [useCirque](../../../src/hooks/useCirque.ts): `load`, `update`, `write`, `reset`, `clearSent`                                                                                                    | RPC、debounce、persist、エラー後の再同期    |
| S3   | [Trackpad page tests](../../../src/pages/__tests__/TrackpadPage.test.tsx)、[useCirque tests](../../../src/hooks/__tests__/useCirque.test.tsx)                                                    | page / hook の回帰根拠                      |
| S4   | [demo-cirque](../../../src/lib/transport/demo-cirque.ts): `CirqueHandler`, `CIRQUE_DEFAULT_STATE`                                                                                                | Demo の擬似 firmware と既定値               |
| S5   | [cirque.proto](../../../proto/tokyo2006/cirque/cirque.proto)、firmware [cirque_handler.c](https://github.com/tokyo2006/cirque-input-module/blob/feat/dya-studio-rpc/src/studio/cirque_handler.c) | protocol と firmware 側の検証・適用・永続化 |

## 機能要求

| ID      | できるべきこと                                                                                          | 出典・確度         |
| ------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| PAD-R01 | Cirque トラックパッドのデータモード、感度、向き、タップ、スクロール、エッジモーション、速度を編集できる | 明示要求（本変更） |
| PAD-R02 | Trackball タブと同じ見た目・操作感で、編集は自動で適用・保存される                                      | 明示要求（本変更） |
| PAD-R03 | 倍率・除数、タップ領域サイズ、エッジモーションのタイミングは折りたたみの `Advanced` にまとめる          | 明示要求（本変更） |
| PAD-R04 | 確認後に firmware 既定値へ戻せる                                                                        | S5 reset から提案  |
| PAD-R05 | Demo で実機なしに操作できる                                                                             | 明示要求（本変更） |

## 前提・状態

- unsupported: `tokyo2006__cirque` を広告しない device では `Trackpad subsystem is not available for your keyboard.` とモジュールへのリンクを表示し、Reload / Reset と設定カードは出さない。
- loading: subsystem があり初回 `getState` 応答前は `Loading trackpad settings...`。
- ready: 6 枚のカード（Basic / Speed / Orientation / Tap / Scroll / Edge Motion）と閉じた `Advanced`。
- dirty: 編集直後はヘッダーに `Pending...`、送信中は `Saving...`（`role="status"`）。idle では表示なし。dirty 中は Reload 無効。
- error: ページ上部の赤枠 alert（`role="alert"`）。自動では消えず、次の load / write / reset 開始時に消える。
- locked: firmware は `ZMK_STUDIO_RPC_HANDLER_UNSECURED` で登録するため通常 unlock は不要。SECURED の firmware ではタブ共通の unlock 経路（S2 `useLockAwareCall`）に従う。
- empty: 該当なし。state は常に全 field を返す（S5 `handle_get_state`）。
- Demo: Subsystems の Demo 切替 `Cirque Trackpad`（index 17、既定 ON）。

## 現行の機能仕様

| ID      | 前提 → 操作                                                                                             | 観測できる結果                                                                                                                            | 保存範囲・副作用                                                                                                                                                                                                            | 根拠     |
| ------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| PAD-001 | 接続（subsystem あり）でタブを開く                                                                      | mount 時に一度 `getState`。値を各 control に表示                                                                                          | read のみ。タブ往復では再読込しない（タブ保持）                                                                                                                                                                             | S1/S2    |
| PAD-002 | switch / radio / slider / number を変更                                                                 | 表示値は即座に変わり `Pending...`                                                                                                         | 最後の変更から 1,500 ms 後に、変更した field だけを 1 回の `setState{persist:true}` で送る。device RAM 適用と flash 保存を同時に行う                                                                                        | S2       |
| PAD-003 | 送信中にさらに同じ field を変更                                                                         | 新しい値を表示し続ける                                                                                                                    | 応答後も新しい値は pending に残り、次の debounce で送る                                                                                                                                                                     | S2       |
| PAD-004 | Basic: `Data Mode` Absolute/Relative、`Sensitivity` 1x/2x                                               | radio（`aria-checked`）が切り替わる                                                                                                       | PAD-002                                                                                                                                                                                                                     | S1       |
| PAD-005 | Orientation: `Rotation` 0°/90°/180°/270°、`Invert X`/`Invert Y`/`Swap X/Y`                              | radio / switch                                                                                                                            | PAD-002。firmware は 0/90/180/270 以外を拒否                                                                                                                                                                                | S1/S5    |
| PAD-006 | Tap: `Tap to Click`、`Secondary Tap`、`Auxiliary Tap`、`Max Tap Duration` 50–1000 ms、`Tap and Drag`    | `Tap and Drag` ON の時だけ `Drag Timeout` 100–1000 ms を表示                                                                              | PAD-002。非表示中も値は保持                                                                                                                                                                                                 | S1       |
| PAD-007 | Scroll: 右端/上端スクロール、`Scroll Zone` 0–500、`Scroll Divisor` 1–64、`Invert Scroll`、`Drag Scroll` | switch / slider                                                                                                                           | PAD-002。`Drag Scroll` は drag-scroll モジュールの runtime 状態で、reset 対象外                                                                                                                                             | S1/S5    |
| PAD-008 | Edge Motion: `Edge Motion` ON で `Edge Zone` 0–500、`Edge Motion Speed` 1–50。`Sleep Mode`              | 依存 slider は ON の時だけ表示                                                                                                            | PAD-002                                                                                                                                                                                                                     | S1       |
| PAD-009 | Speed: `Pointer Speed` / `Scroll Speed` 0–100                                                           | slider                                                                                                                                    | PAD-002。firmware は 100 に丸める。reset 対象外                                                                                                                                                                             | S1/S5    |
| PAD-010 | `Advanced` を開き number input を編集                                                                   | 13 項目（タップ移動量、クリック時間、ドラッグ移動量、副/補助タップ領域の幅・高さ、エッジモーション間隔・開始遅延、相対/絶対の倍率・除数） | 入力中は自由に編集でき送信しない。blur / Enter で確定し、整数のみ min–max に丸めて PAD-002 へ（除数・倍率は 1 以上、その他 0 以上、上限は u16/u32）。空欄・小数は破棄して元の値を表示。丸めた結果が現在値と同じなら送らない | S1       |
| PAD-011 | `Reset to defaults` → dialog `Reset trackpad settings?` → `Reset to defaults`                           | 成功で dialog が閉じ、既定値を表示                                                                                                        | 待機中の編集を破棄し `reset{factoryDefaults:true}`。firmware は runtime を既定値に戻し保存値を消去。Speed と Drag Scroll は変わらない                                                                                       | S1/S2/S5 |
| PAD-012 | reset dialog で `Cancel` / Escape / 外側クリック                                                        | dialog が閉じる                                                                                                                           | RPC なし。reset 中は閉じられない                                                                                                                                                                                            | S1       |
| PAD-013 | `Reload`                                                                                                | `getState` で再読込                                                                                                                       | pending / saving 中は無効                                                                                                                                                                                                   | S1/S2    |
| PAD-014 | Subsystems タブ                                                                                         | `tokyo2006__cirque` は `Already supported by DYA Studio` に含まれる                                                                       | [CustomSubsystemsPage](../../../src/pages/CustomSubsystemsPage.tsx) `SUPPORTED_SUBSYSTEM_IDENTIFIERS`                                                                                                                       | —        |

## 代表ユーザーフロー

1. F1 編集と保存（PAD-001/002/005）: Demo 接続 → `Trackpad` → `Invert X` を ON、`Rotation` を 90° → `Pending...` → 約 1.5 秒後に表示が消える → 別タブに移って戻り、`Reload` しても ON / 90° のまま。後始末: 元に戻す。
2. F2 依存 control（PAD-006/008）: `Tap and Drag` OFF で `Drag Timeout` が無い → ON で 350ms が現れる → OFF で消える。
3. F3 Advanced の境界（PAD-010）: `Relative Divisor` を 4 にして確定 → 0 を入力して blur → 1 に丸めて送る。`Max Tap Movement` を空欄にして blur → 200 に戻り送信しない。
4. F4 リセット（PAD-011/012）: `Max Tap Duration` を 400ms にする → `Reset to defaults` → `Cancel` で何も変わらない → 再度開き確定 → 250ms に戻る。`Pointer Speed` は維持。
5. F5 unsupported（前提・状態）: Subsystems の Demo 切替で `Cirque Trackpad` を OFF → 再接続 → `Trackpad` に未対応の案内とリンク。

## 不変条件

- PAD-I01: 変更していない field を `setState` に含めない（他クライアント・firmware 側の値を上書きしない）。確認: S3 hook test が `scrollZone` 未送信を検証。
- PAD-I02: reset 確定前に RPC を送らない。確認: S3 page test。
- PAD-I03: 送信中に再編集した値を、古い送信の応答で巻き戻さない。防御: S2 `clearSent` は送信値と一致する pending だけを消す。
- PAD-I04: firmware 拒否後に UI が device と異なる値を表示し続けない。防御: S2 `write` が拒否時に `getState` で再同期。

## エラーと復帰

- `setState` 拒否（例: firmware の `rotateDegrees failed (-22)`）: ページ alert に firmware の文言。firmware は有効な他 field を適用済みのため `getState` で再同期した値を表示。Demo では UI 上到達不能（rotation は radio のみ）、hook test で検証。
- RPC 例外 / timeout: `Failed to save trackpad settings: ...` / `Failed to load trackpad state: ...`。再編集または `Reload` で再試行。
- reset 失敗: dialog を開いたまま dialog 内とページに alert。再度確定で再試行。
- lock / cancel: 共通の locked 文言（S2 `useLockAwareCall`）。
- 切断: pending を破棄し state を消す。

## 探索の観点

1. slider を素早く往復 → 送信が 1 回にまとまり、最後の値が残るか。
2. `Saving...` 中に同じ field を変更（PAD-003 / PAD-I03）。
3. Advanced の number input に負数・小数・非常に大きい値・貼り付けを試す。
4. reset 直前に編集して即 reset（待機中の編集が後から送られないか）。
5. 狭い画面幅でカードが 1 列になり、radio が折り返して操作できるか。
6. ja / zh 表示で文言のはみ出し。

## 既知の受け入れ済み不具合

承認根拠を確認できたものはなし。

## 未解決・未検証

- 実機未検証: absolute / relative 切替時の挙動、スプリット構成での relay 同期（firmware `cirque_relay_send_state`）、flash 保存後の電源断。
- slider の範囲は UI 側の選択で firmware 検証ではない（firmware は rotation と scroll divisor 以外を検証しない）。倍率・除数の実用範囲は未確認。
- データモードごとにどの設定が効くかを UI は区別していない（モジュール README の feature map 参照）。
- Version history（capture / restore）は未対応。
